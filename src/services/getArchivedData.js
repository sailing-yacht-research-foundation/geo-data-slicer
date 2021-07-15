const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const execSync = require('child_process').execSync;
const turf = require('@turf/turf');

const db = require('../models');
const mainDB = require('../models/mainDB');
const downloadFromS3 = require('../utils/downloadFromS3');
const sliceGribByPoint = require('../utils/sliceGribByPoint');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
const uploadStreamToS3 = require('../utils/uploadStreamToS3');

const Op = db.Sequelize.Op;
const bucketName = process.env.AWS_S3_BUCKET;

async function downloadArchivedData(files) {
  // Download said s3 files.
  const downloadedFiles = await Promise.all(
    files.map(async (row) => {
      const { id, model, start_time, end_time, grib_file_url } = row;
      const downloadPath = path.resolve(__dirname, `../../${id}.grib2`);
      const downloadResult = await downloadFromS3(
        bucketName,
        grib_file_url,
        downloadPath,
      );
      return {
        id,
        model,
        start_time,
        end_time,
        gribFilePath: downloadResult ? downloadPath : null,
      };
    }),
  );
  return downloadedFiles;
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
    raw: true,
  });
  return downloadArchivedData(files);
}

async function getWeatherFilesByPoint(point, startTime, endTime) {
  const query = `SELECT "model_name" FROM "SourceModels" WHERE ST_Contains ( "spatial_boundary", ST_GeomFromText ( :point, 4326 ) )`;
  const result = await db.sequelize.query(query, {
    replacements: {
      point: `POINT (${point.geometry.coordinates[0]} ${point.geometry.coordinates[1]})`,
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
    where: {
      model: { [Op.in]: modelsToFetch },
      [Op.or]: [
        {
          start_time: {
            [Op.between]: [startDate, endDate],
          },
        },
        {
          end_time: {
            [Op.between]: [startDate, endDate],
          },
        },
      ],
    },
    raw: true,
  });
  return downloadArchivedData(files);
}

async function getArchivedDataByRegion(roi, startTime, endTime) {
  const downloadedFiles = await getWeatherFilesByRegion(
    roi,
    startTime,
    endTime,
  );
  // Slice GRIBs into regions using wgrib2 or cdo, then convert to geojson and (either upload gribs and geojson to s3 and save the record or send this info to the analysis engine so it can do it).
  const bbox = turf.bbox(roi);
  const bboxPolygon = turf.bboxPolygon(bbox);

  const data = await Promise.all(
    downloadedFiles.map(async (row) => {
      const { id, model, start_time, end_time, gribFilePath } = row;
      const { slicedGrib, geoJsons } = sliceGribByRegion(bbox, gribFilePath, {
        folder: path.resolve(__dirname, `../../`),
        fileID: id,
        model,
      });

      const gribStream = fs.createReadStream(slicedGrib);
      const gribUuid = uuidv4();
      const { writeStream: gribWriteStream, uploadPromise: gribUploadPromise } =
        uploadStreamToS3(`gribs/${model}/${gribUuid}.grib2`);
      gribStream.on('open', function () {
        gribStream.pipe(gribWriteStream);
      });
      const gribDetail = await gribUploadPromise;
      execSync(`rm ${slicedGrib}`);

      const jsonFiles = await Promise.all(
        geoJsons.map(async (json) => {
          // write to stream
          const uuid = uuidv4();
          const { writeStream, uploadPromise } = uploadStreamToS3(
            `geojson/${model}/${uuid}.json`,
          );
          const readable = Readable.from([JSON.stringify(json)]);
          readable.pipe(writeStream);
          const jsonDetail = await uploadPromise;
          return { uuid, key: jsonDetail.Key };
        }),
      );

      await mainDB.slicedWeather.bulkCreate(
        [
          {
            id: gribUuid,
            model,
            start_time,
            end_time,
            s3_key: gribDetail.Key,
            file_type: 'GRIB',
            bounding_box: bboxPolygon.geometry,
          },
          ...jsonFiles.map((row) => {
            return {
              id: row.uuid,
              model,
              start_time,
              end_time,
              s3_key: row.key,
              file_type: 'JSON',
              bounding_box: bboxPolygon.geometry,
            };
          }),
        ],
        {
          ignoreDuplicates: true,
          validate: true,
        },
      );
      return {
        id,
        model,
        start_time,
        end_time,
        slicedGrib: gribDetail.Key,
        geoJsons: jsonFiles,
      };
    }),
  );

  return data;
}

async function getArchivedDataByPoint(point, startTime, endTime) {
  const downloadedFiles = await getWeatherFilesByPoint(
    point,
    startTime,
    endTime,
  );
  const data = await Promise.all(
    downloadedFiles.map((row) => {
      const { id, model, start_time, end_time, gribFilePath } = row;
      const geojsons = sliceGribByPoint(point, gribFilePath, {
        folder: path.resolve(__dirname, `../../`),
        fileID: id,
      });
      return { id, model, start_time, end_time, geojsons };
    }),
  );
  return data;
}

module.exports = {
  getArchivedDataByRegion,
  getArchivedDataByPoint,
};
