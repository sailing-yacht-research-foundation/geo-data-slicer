const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');

const db = require('../models');
const mainDB = require('../models/mainDB');
const downloadFromS3 = require('../utils/downloadFromS3');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
const uploadStreamToS3 = require('../utils/uploadStreamToS3');
const logger = require('../logger');
const { VALID_TIMEFRAME } = require('../configs/sourceModel.config');
const Queue = require('../classes/Queue');
const { MAX_AREA_CONCURRENT_RUN } = require('../configs/general.config');

const Op = db.Sequelize.Op;
const bucketName = process.env.AWS_S3_BUCKET;
const slicedBucket = process.env.AWS_S3_SLICED_BUCKET;

async function removeRedundantFiles(files) {
  const finalFiles = [];
  for (let i = 0; i < files.length; i++) {
    const { created_at, model, start_time, end_time } = files[i];
    const similarFile = finalFiles.find((record) => {
      if (
        record.model === model &&
        String(record.start_time) === String(start_time) &&
        String(record.end_time) === String(end_time)
      ) {
        return true;
      }
      return false;
    });
    if (similarFile) {
      // Only mutate if created at is newer
      if (similarFile.created_at < created_at) {
        // mutate the value into
        similarFile = { ...files[i] };
      }
    } else {
      // No file exist
      finalFiles.push({ ...files[i] });
    }
  }
  return finalFiles;
}

async function getWeatherFilesByRegion(roi, startTime, endTime) {
  const query = `SELECT "model_name" FROM "SourceModels" WHERE ST_Contains ( "spatial_boundary", ST_GeomFromText ( :polygon, 4326 ) )`;
  const result = await db.sequelize.query(query, {
    replacements: {
      polygon: `POLYGON((${roi.geometry.coordinates[0]
        .map((row) => {
          return `${row[0]} ${row[1]}`;
        })
        .join(',')}))`,
    },
    type: db.sequelize.QueryTypes.SELECT,
  });

  const globalModels = await db.sourceModel.findAll({
    attributes: ['model_name'],
    where: { spatial_boundary: { [Op.eq]: null } },
    raw: true,
  });
  let modelsToFetch = globalModels.map((row) => row.model_name);
  if (result.length > 0) {
    modelsToFetch = [
      ...modelsToFetch,
      ...result.map((row) => {
        return row.model_name;
      }),
    ];
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const files = await db.weatherData.findAll({
    limit: 3, //TODO: Remove limit after testing
    where: {
      model: { [Op.in]: modelsToFetch },
      [Op.or]: [
        {
          start_time: {
            [Op.lte]: startDate,
          },
          end_time: {
            [Op.gte]: startDate,
          },
        },
        {
          start_time: {
            [Op.lte]: endDate,
          },
          end_time: {
            [Op.gte]: endDate,
          },
        },
      ],
    },
    order: [['created_at', 'DESC']],
    raw: true,
  });
  return removeRedundantFiles(files);
}

async function processFunction(data) {
  const {
    id,
    model,
    start_time,
    end_time,
    grib_file_url,
    bbox,
    searchStartTime,
    searchEndTime,
    raceID,
  } = data;
  logger.info(`Processing ${model} - ${id}`);
  const downloadPath = path.resolve(
    __dirname,
    `../../operating_folder/${id}.grib2`,
  );
  try {
    await downloadFromS3(bucketName, grib_file_url, downloadPath);
  } catch (error) {
    logger.error(`Error downloading grib: ${error.message}`);
    return [];
  }
  const bboxPolygon = turf.bboxPolygon(bbox);
  const currentTime = new Date();
  const currentYear = String(currentTime.getUTCFullYear());
  const currentMonth = String(currentTime.getUTCMonth() + 1).padStart(2, '0');
  const currentDate = String(currentTime.getUTCDate()).padStart(2, '0');

  if (!fs.existsSync(downloadPath)) {
    logger.error(
      `Download didn't fail, but file doesn't exist at download path. ID: ${id}, timestamp: ${currentTime.toISOString()}`,
    );
    return [];
  }
  const { slicedGribs, geoJsons, runtimes } = await sliceGribByRegion(
    bbox,
    downloadPath,
    {
      folder: path.resolve(__dirname, `../../operating_folder/`),
      fileID: id,
      model,
      searchStartTime,
      searchEndTime,
    },
  );
  // Gribs upload process
  logger.info(`Uploading gribs from processing ${id}`);
  const gribFiles = await Promise.all(
    slicedGribs.map(async (slicedGrib) => {
      const { filePath, variables, levels } = slicedGrib;
      let gribDetail = null;
      const gribStream = fs.createReadStream(filePath);
      const gribUuid = uuidv4();
      try {
        const {
          writeStream: gribWriteStream,
          uploadPromise: gribUploadPromise,
        } = uploadStreamToS3(
          `${model}/${currentYear}/${currentMonth}/${currentDate}/forecast/${variables.join(
            '-',
          )}/gribfile/${gribUuid}.grib2`,
          slicedBucket,
        );
        gribStream.on('open', function () {
          gribStream.pipe(gribWriteStream);
        });
        gribDetail = await gribUploadPromise;
      } catch (error) {
        logger.error(`Error uploading grib: ${error.message}`);
      }

      fs.unlink(filePath, () => {
        logger.info(`sliced grib of model ${model}-${id} has been deleted`);
      });
      return {
        id: gribUuid,
        s3Key: gribDetail ? gribDetail.Key : null,
        variables,
        levels,
      };
    }),
  );

  // End of Smaller grib upload process

  // GeoJSON stream to s3
  logger.info(`Uploading jsons from processing ${id}.`);
  const jsonFiles = await Promise.all(
    geoJsons
      .filter((json) => {
        const endTimeModifier = VALID_TIMEFRAME[model] || 3600000;
        const jsonStartTime = `${json.time}+00`;
        const jsonStartTimeUnix = Date.parse(jsonStartTime);
        const jsonEndTimeUnix = new Date(
          jsonStartTimeUnix + endTimeModifier,
        ).getTime();

        if (
          searchStartTime <= jsonEndTimeUnix &&
          searchEndTime >= jsonStartTimeUnix
        ) {
          return true;
        }
        return false;
      })
      .map(async (json) => {
        try {
          const uuid = uuidv4();
          const { variables, time, level, filePath } = json;
          const gsTimes = [`${time}+00`];

          const { writeStream, uploadPromise } = uploadStreamToS3(
            `${model}/${currentYear}/${currentMonth}/${currentDate}/forecast/${variables.join(
              '-',
            )}/geojson/${uuid}.json`,
            slicedBucket,
          );
          const readStream = fs.createReadStream(filePath);
          readStream.pipe(writeStream);
          const jsonDetail = await uploadPromise;
          fs.unlink(filePath, () => {
            logger.info(`sliced json of model ${model}-${id} has been deleted`);
          });

          const endTimeModifier = VALID_TIMEFRAME[model] || 3600000;
          const startTime = gsTimes[0];
          const startTimeInUnix = Date.parse(startTime);
          const endTime = new Date(startTimeInUnix + endTimeModifier);

          return {
            uuid,
            startTime: startTimeInUnix,
            endTime: endTime.toISOString(),
            key: jsonDetail.Key,
            levels: [level],
            runtimes: gsTimes,
            variables,
          };
        } catch (error) {
          logger.error(`Error uploading geojson: ${error.message}`);
          return null;
        }
      }),
  );
  // End of geojson stream to s3
  // Saving to DB
  const successJsons = jsonFiles.filter((row) => row !== null);
  const arrayData = [
    ...gribFiles
      .filter((row) => {
        return row.s3Key !== null;
      })
      .map((row) => {
        return {
          id: row.id,
          model,
          startTime: start_time,
          endTime: end_time,
          s3Key: row.s3Key,
          fileType: 'GRIB',
          boundingBox: bboxPolygon.geometry,
          levels: row.levels,
          variables: row.variables,
          runtimes,
          competitionUnitId: raceID,
        };
      }),
    ...successJsons.map((row) => {
      return {
        id: row.uuid,
        model,
        startTime: row.startTime,
        endTime: row.endTime,
        s3Key: row.key,
        fileType: 'JSON',
        boundingBox: bboxPolygon.geometry,
        levels: row.levels,
        variables: row.variables,
        runtimes: row.runtimes,
        competitionUnitId: raceID,
      };
    }),
  ];
  try {
    await mainDB.slicedWeather.bulkCreate(arrayData, {
      ignoreDuplicates: true,
      validate: true,
    });
  } catch (error) {
    logger.error(`Error saving metadata to DB: ${error.message}`);
  }
  return successJsons.map((row) => {
    return {
      key: row.key,
      model,
      levels: row.levels,
      variables: row.variables,
      runtimes: row.runtimes,
    };
  });
}

async function getArchivedData(bbox, startTime, endTime, raceID) {
  const bboxPolygon = turf.bboxPolygon(bbox);
  const files = await getWeatherFilesByRegion(bboxPolygon, startTime, endTime);

  let maxConcurrentProcess = 3;
  if (turf.area(bboxPolygon) > MAX_AREA_CONCURRENT_RUN) {
    maxConcurrentProcess = 1;
  }
  const queue = new Queue({
    maxConcurrentProcess,
    processFunction,
  });
  files.forEach((row) => {
    queue.enqueue({
      ...row,
      bbox,
      searchStartTime: startTime,
      searchEndTime: endTime,
      raceID,
    });
  });

  // TODO: Wait queue to finish and return
  return [];
}

module.exports = getArchivedData;
