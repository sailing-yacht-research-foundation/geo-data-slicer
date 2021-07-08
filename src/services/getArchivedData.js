const path = require('path');
const db = require('../models');
const downloadFromS3 = require('../utils/downloadFromS3');
const sliceGribByPoint = require('../utils/sliceGribByPoint');
const sliceGribByRegion = require('../utils/sliceGribByRegion');

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

async function getArchivedDataByRegion(roi, downloadedFiles) {
  // Slice GRIBs into regions using wgrib2 or cdo, then convert to geojson and (either upload gribs and geojson to s3 and save the record or send this info to the analysis engine so it can do it).
  const jsonFiles = await Promise.all(
    downloadedFiles.map((row) => {
      const { id, model, start_time, end_time, gribFilePath } = row;
      const geojsons = sliceGribByRegion(roi, gribFilePath, {
        folder: path.resolve(__dirname, `../../`),
        fileID: id,
      });
      return { id, model, start_time, end_time, geojsons };
    }),
  );

  // Return with a either a list of sliced files in an s3 bucket just for sliced data, or actually return the geojson objects with time and boundary info.

  return jsonFiles;
}

async function getArchivedDataByPoint(point, downloadedFiles) {
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
  getWeatherFilesByRegion,
  getWeatherFilesByPoint,
  getArchivedDataByRegion,
  getArchivedDataByPoint,
};
