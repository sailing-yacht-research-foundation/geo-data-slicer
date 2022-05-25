const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');
const _ = require('lodash');

const Queue = require('../classes/Queue');
const logger = require('../logger');
const db = require('../models');
const slicedWeatherDAL = require('../syrf-schema/dataAccess/v1/slicedWeather');
const downloadFromS3 = require('../utils/downloadFromS3');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
const uploadStreamToS3 = require('../utils/uploadStreamToS3');
const { VALID_TIMEFRAME } = require('../configs/sourceModel.config');
const {
  MAX_AREA_CONCURRENT_RUN,
  WEATHER_FILE_TYPES,
} = require('../configs/general.config');

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
    // limit: 3, //TODO: Remove limit after testing
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
  const randomizedID = uuidv4();
  logger.info(`Processing ${model} - ${id} -> ${randomizedID}`);
  const downloadPath = path.resolve(
    __dirname,
    // Instead of using original id, use random id, so multiple request that use same file won't throw error on deletion
    `../../operating_folder/${randomizedID}.grib2`,
  );
  try {
    await downloadFromS3(bucketName, grib_file_url, downloadPath);
  } catch (error) {
    logger.error(`Error downloading grib: ${error.message}`);
    return [];
  }
  const bboxString = bbox.join(',');
  const bboxPolygon = turf.bboxPolygon(bbox);
  const currentTime = new Date();
  const currentYear = String(currentTime.getUTCFullYear());
  const currentMonth = String(currentTime.getUTCMonth() + 1).padStart(2, '0');
  const currentDate = String(currentTime.getUTCDate()).padStart(2, '0');

  if (!fs.existsSync(downloadPath)) {
    logger.error(
      `Download didn't fail, but file doesn't exist at download path. ID: ${id} / ${randomizedID}, timestamp: ${currentTime.toISOString()}`,
    );
    return [];
  }

  const existingSlices = await slicedWeatherDAL.findExistingSlices({
    competitionUnitId: raceID,
    originalFileId: id,
  });

  const targetFolder = path.resolve(
    __dirname,
    `../../operating_folder/${randomizedID}`,
  );
  try {
    await fs.promises.access(targetFolder);
  } catch (error) {
    await fs.promises.mkdir(targetFolder);
  }

  const { slicedGribs, geoJsons, runtimes } = await sliceGribByRegion(
    bbox,
    downloadPath,
    {
      folder: targetFolder,
      fileID: randomizedID,
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
      const gribUuid = uuidv4();
      const sameSlice = existingSlices.find((sliceRow) => {
        if (
          sliceRow.fileType !== WEATHER_FILE_TYPES.grib ||
          !_.isEqual(levels, sliceRow.levels) ||
          !_.isEqual(variables, sliceRow.variables) ||
          bboxString !== turf.bbox(sliceRow.boundingBox).join(',')
        ) {
          return false;
        }
        return true;
      });
      if (!sameSlice) {
        try {
          const gribStream = fs.createReadStream(filePath);
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
      } else {
        logger.info(
          `Skipped uploading a grib slice of ${id}. Level: ${levels.join(
            ',',
          )}, Var: ${variables.join(',')}`,
        );
      }

      fs.unlink(filePath, (err) => {
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
        const jsonEndTimeUnix = jsonStartTimeUnix + endTimeModifier;

        if (
          searchStartTime <= jsonEndTimeUnix &&
          searchEndTime >= jsonStartTimeUnix
        ) {
          return true;
        }
        return false;
      })
      .map(async (json) => {
        const uuid = uuidv4();
        const { variables, time, level, filePath } = json;
        const gsTimes = [new Date(`${time}+00`)];

        const endTimeModifier = VALID_TIMEFRAME[model] || 3600000;
        const startTime = gsTimes[0];
        const startTimeInUnix = Date.parse(startTime);
        const endTimeInUnix = startTimeInUnix + endTimeModifier;
        let jsonDetail = null;

        const sameSlice = existingSlices.find((sliceRow) => {
          if (
            sliceRow.fileType !== WEATHER_FILE_TYPES.json ||
            startTimeInUnix !== Date.parse(sliceRow.startTime) ||
            endTimeInUnix !== Date.parse(sliceRow.endTime) ||
            !_.isEqual([level], sliceRow.levels) ||
            !_.isEqual(variables, sliceRow.variables) ||
            !_.isEqual(gsTimes, sliceRow.runtimes) ||
            bboxString !== turf.bbox(sliceRow.boundingBox).join(',')
          ) {
            return false;
          }
          return true;
        });
        if (!sameSlice) {
          try {
            const { writeStream, uploadPromise } = uploadStreamToS3(
              `${model}/${currentYear}/${currentMonth}/${currentDate}/forecast/${variables.join(
                '-',
              )}/geojson/${uuid}.json`,
              slicedBucket,
            );
            const readStream = fs.createReadStream(filePath);
            readStream.pipe(writeStream);
            jsonDetail = await uploadPromise;
          } catch (error) {
            logger.error(`Error uploading geojson: ${error.message}`);
          }
        } else {
          logger.info(
            `Skipped uploading a json slice of ${id}. Level: ${level}, Time: ${time}, Var: ${variables.join(
              ',',
            )}`,
          );
        }

        fs.unlink(filePath, () => {
          logger.info(`sliced json of model ${model}-${id} has been deleted`);
        });

        return {
          uuid,
          startTime: startTimeInUnix,
          endTime: endTimeInUnix,
          s3Key: jsonDetail?.Key,
          levels: [level],
          runtimes: gsTimes,
          variables,
        };
      }),
  );
  // End of geojson stream to s3
  // Saving to DB
  const successJsons = jsonFiles.filter((row) => row !== null);
  const arrayData = [
    ...gribFiles
      .filter((row) => {
        return row.s3Key != null;
      })
      .map((row) => {
        return {
          id: row.id,
          model,
          startTime: start_time,
          endTime: end_time,
          s3Key: row.s3Key,
          fileType: WEATHER_FILE_TYPES.grib,
          boundingBox: bboxPolygon.geometry,
          levels: row.levels,
          variables: row.variables,
          runtimes,
          competitionUnitId: raceID,
          originalFileId: id,
          sliceDate: currentTime,
        };
      }),
    ...successJsons
      .filter((row) => {
        return row.s3Key != null;
      })
      .map((row) => {
        return {
          id: row.uuid,
          model,
          startTime: row.startTime,
          endTime: row.endTime,
          s3Key: row.s3Key,
          fileType: WEATHER_FILE_TYPES.json,
          boundingBox: bboxPolygon.geometry,
          levels: row.levels,
          variables: row.variables,
          runtimes: row.runtimes,
          competitionUnitId: raceID,
          originalFileId: id,
          sliceDate: currentTime,
        };
      }),
  ];

  if (arrayData.length > 0) {
    try {
      await slicedWeatherDAL.bulkInsert(arrayData);
    } catch (error) {
      logger.error(`Error saving metadata to DB: ${error.message}`);
    }
  }

  // Delete the folder no matter what the result is
  try {
    await fs.promises.rm(targetFolder, { recursive: true });
  } catch (error) {
    logger.error(`Error while cleaning up operation: ${error.message}`);
  }

  return successJsons.map((row) => {
    return {
      key: row.s3Key,
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
  queue.enqueue(
    files.map((row) => {
      return {
        ...row,
        bbox,
        searchStartTime: startTime,
        searchEndTime: endTime,
        raceID,
      };
    }),
  );

  const results = await queue.waitFinish();
  return results;
}

module.exports = getArchivedData;
