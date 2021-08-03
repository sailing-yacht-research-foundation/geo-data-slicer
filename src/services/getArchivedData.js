const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const turf = require('@turf/turf');

const db = require('../models');
const mainDB = require('../models/mainDB');
const downloadFromS3 = require('../utils/downloadFromS3');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
const uploadStreamToS3 = require('../utils/uploadStreamToS3');
const logger = require('../logger');
const { VALID_TIMEFRAME } = require('../configs/sourceModel.config');

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

  let modelsToFetch = ['GFS', 'RTOFS_GLOBAL', 'ARPEGE_WORLD'];
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

async function getArchivedData(roi, startTime, endTime, raceID) {
  const files = await getWeatherFilesByRegion(roi, startTime, endTime);
  console.log(files);
  const bbox = turf.bbox(roi);
  const bboxPolygon = turf.bboxPolygon(bbox);

  const data = await Promise.all(
    files.map(async (row) => {
      const { id, model, start_time, end_time, grib_file_url } = row;
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

      const { slicedGrib, geoJsons, levels, variables, runtimes } =
        sliceGribByRegion(bbox, downloadPath, {
          folder: path.resolve(__dirname, `../../operating_folder/`),
          fileID: id,
          model,
        });
      // Smaller Grib upload process
      let gribDetail = null;
      const gribStream = fs.createReadStream(slicedGrib);
      const gribUuid = uuidv4();
      try {
        const {
          writeStream: gribWriteStream,
          uploadPromise: gribUploadPromise,
        } = uploadStreamToS3(`gribs/${model}/${gribUuid}.grib2`, slicedBucket);
        gribStream.on('open', function () {
          gribStream.pipe(gribWriteStream);
        });
        gribDetail = await gribUploadPromise;
      } catch (error) {
        logger.error(`Error uploading grib: ${error.message}`);
      }

      fs.unlink(slicedGrib, () => {
        logger.info(`sliced grib of model ${model}-${id} has been deleted`);
      });
      // End of Smaller grib upload process

      // GeoJSON stream to s3
      const jsonFiles = await Promise.all(
        geoJsons
          .filter((json) => {
            const endTimeModifier = VALID_TIMEFRAME[model] || 3600000;
            const jsonStartTime = `${json.properties.time}+00`;
            const jsonStartTimeUnix = Date.parse(jsonStartTime);
            const jsonEndTimeUnix = new Date(
              jsonStartTimeUnix + endTimeModifier,
            );

            if (
              (jsonStartTimeUnix <= endTime &&
                jsonStartTimeUnix >= startTime) ||
              (jsonEndTimeUnix <= endTime && jsonEndTimeUnix >= startTime)
            ) {
              return true;
            }
            return false;
          })
          .map(async (json) => {
            try {
              const uuid = uuidv4();

              const gsVariables = new Set();
              const gsLevels = [json.properties.level];
              const gsTimes = [`${json.properties.time}+00`];
              if (json.features[0]) {
                for (const variable in json.features[0].properties) {
                  gsVariables.add(variable);
                }
              }

              const { writeStream, uploadPromise } = uploadStreamToS3(
                `geojson/${model}/${uuid}.json`,
                slicedBucket,
              );
              const readable = Readable.from([JSON.stringify(json)]);
              readable.pipe(writeStream);
              const jsonDetail = await uploadPromise;

              const endTimeModifier = VALID_TIMEFRAME[model] || 3600000;
              const startTime = gsTimes[0];
              const startTimeInUnix = Date.parse(startTime);
              const endTime = new Date(startTimeInUnix + endTimeModifier);

              return {
                uuid,
                start_time: `${json.properties.time}+00`,
                end_time: endTime.toISOString(),
                key: jsonDetail.Key,
                levels: gsLevels,
                runtimes: gsTimes,
                variables: Array.from(gsVariables),
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
        ...(gribDetail
          ? [
              {
                id: gribUuid,
                model,
                start_time,
                end_time,
                s3_key: gribDetail.Key,
                file_type: 'GRIB',
                bounding_box: bboxPolygon.geometry,
                levels,
                variables,
                runtimes,
                race_id: raceID,
              },
            ]
          : []),
        ...successJsons.map((row) => {
          return {
            id: row.uuid,
            model,
            start_time: row.start_time, // Since json files only 1 runtime for each file, need to replace start_time of the grib
            end_time: row.end_time,
            s3_key: row.key,
            file_type: 'JSON',
            bounding_box: bboxPolygon.geometry,
            levels: row.levels,
            variables: row.variables,
            runtimes: row.runtimes,
            race_id: raceID,
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
    }),
  );

  return data.flat();
}

module.exports = getArchivedData;
