const fs = require('fs');
const fsPromise = require('fs/promises');
const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');
const _ = require('lodash');

const logger = require('../logger');
const { WEATHER_FILE_TYPES } = require('../configs/general.config');
const { VALID_TIMEFRAME } = require('../configs/sourceModel.config');
const uploadStreamToS3 = require('../utils/uploadStreamToS3');
const slicedWeatherDAL = require('../syrf-schema/dataAccess/v1/slicedWeather');

const slicedBucket = process.env.AWS_S3_SLICED_BUCKET;

async function uploadSlicedGribs(
  slicedGribs,
  { competitionUnitId, bboxString, originalFileId, model },
) {
  const existingSlices = await slicedWeatherDAL.findExistingSlices({
    competitionUnitId,
    originalFileId,
    fileType: WEATHER_FILE_TYPES.grib,
  });

  const currentTime = new Date();
  const currentYear = String(currentTime.getUTCFullYear());
  const currentMonth = String(currentTime.getUTCMonth() + 1).padStart(2, '0');
  const currentDate = String(currentTime.getUTCDate()).padStart(2, '0');

  let existGribCount = 0;
  let failedFileDeletion = 0;
  const gribFiles = await Promise.all(
    slicedGribs.map(async (slicedGrib) => {
      const { filePath, variables, levels, runtimes: rawRuntimes } = slicedGrib;
      const runtimes = rawRuntimes.map((row) => new Date(row));
      let gribDetail = null;
      const gribUuid = uuidv4();
      const endTimeModifier = VALID_TIMEFRAME[model] || 3600000;
      const startTimeInUnix = runtimes[0].getTime();
      const endTimeInUnix = startTimeInUnix + endTimeModifier;

      const sameSlice = existingSlices.find((sliceRow) => {
        if (
          sliceRow.fileType !== WEATHER_FILE_TYPES.grib ||
          startTimeInUnix !== Date.parse(sliceRow.startTime) ||
          endTimeInUnix !== Date.parse(sliceRow.endTime) ||
          !_.isEqual(levels, sliceRow.levels) ||
          !_.isEqual(variables, sliceRow.variables) ||
          !_.isEqual(runtimes, sliceRow.runtimes) ||
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
        existGribCount++;
      }

      try {
        await fsPromise.unlink(filePath);
      } catch (_err) {
        failedFileDeletion++;
      }

      return {
        id: gribUuid,
        s3Key: gribDetail ? gribDetail.Key : null,
        variables,
        levels,
        runtimes,
        startTime: startTimeInUnix,
        endTime: endTimeInUnix,
      };
    }),
  );

  if (existGribCount > 0) {
    logger.info(
      `Skipped uploading ${existGribCount} grib slices of ${
        originalFileId ?? '-'
      }.`,
    );
  }
  if (failedFileDeletion > 0) {
    logger.error(`${failedFileDeletion} files errored during deletion!`);
  }

  return gribFiles.filter((row) => {
    return row.s3Key != null;
  });
}

async function uploadSlicedGeoJsons(
  geoJsons,
  { competitionUnitId, bboxString, originalFileId, model },
) {
  const existingSlices = await slicedWeatherDAL.findExistingSlices({
    competitionUnitId,
    originalFileId,
    fileType: WEATHER_FILE_TYPES.json,
  });

  const currentTime = new Date();
  const currentYear = String(currentTime.getUTCFullYear());
  const currentMonth = String(currentTime.getUTCMonth() + 1).padStart(2, '0');
  const currentDate = String(currentTime.getUTCDate()).padStart(2, '0');

  let existJsonCount = 0;
  let failedFileDeletion = 0;
  const jsonFiles = await Promise.all(
    geoJsons.map(async (json) => {
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
        existJsonCount++;
      }

      try {
        await fsPromise.unlink(filePath);
      } catch (_err) {
        failedFileDeletion++;
      }

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

  if (existJsonCount > 0) {
    logger.info(
      `Skipped uploading ${existJsonCount} json slices of ${
        originalFileId ?? '-'
      }.`,
    );
  }
  if (failedFileDeletion > 0) {
    logger.error(`${failedFileDeletion} files errored during deletion!`);
  }

  return jsonFiles.filter((row) => row.s3Key != null);
}

module.exports = { uploadSlicedGribs, uploadSlicedGeoJsons };
