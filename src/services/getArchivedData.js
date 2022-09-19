const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const turf = require('@turf/turf');

const logger = require('../logger');
const db = require('../models');
const slicedWeatherDAL = require('../syrf-schema/dataAccess/v1/slicedWeather');
const downloadFromS3 = require('../utils/downloadFromS3');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
const {
  WEATHER_FILE_TYPES,
  MAX_SLICE_FILE_COUNT,
} = require('../configs/general.config');
const {
  uploadSlicedGribs,
  uploadSlicedGeoJsons,
} = require('./uploadSlicedFiles');
const skipSliceDAL = require('../syrf-schema/dataAccess/v1/skippedCompetitionWeather');

const Op = db.Sequelize.Op;
const bucketName = process.env.AWS_S3_BUCKET;

exports.removeRedundantFiles = async (files) => {
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
};

exports.getWeatherFilesByRegion = async (roi, startTime, endTime) => {
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

  /*
    Important Notes on this query.
    The original query works for track nows, and syrf regular races (with a bug found during testing), it triggers index scan.
    However, when it tries to slice older races, regardless of source, it becomes very slow (200s++). The query becomes a seq scan and much slower.
    Several solutions has been tried (gist index, multicol index, tstzrange, etc) but everything is either not working or still very slow.
    From reading around here and there, the cause seems to be how postgresql automatically decide whether to use index or not on certain datasets, 
    judging from the condition. It seems if the condition returns more than certain  threshold of the data, it uses seq scan instead of index scan.
    So to make sure it's using index scan, each column must be limited 

    References: 
    https://dba.stackexchange.com/questions/39589/optimizing-queries-on-a-range-of-timestamps-two-columns
    https://stackoverflow.com/questions/8839117/postgresql-date-query-performance-problems
    https://stackoverflow.com/questions/1063043/how-to-release-possible-postgres-row-locks
    https://stackoverflow.com/questions/67759944/postgresql-best-index-for-datetime-ranges

    For gist index on range, tested using small local db, the analysis score is still using seq scan, but this test is not done in the actual db
    because creating the index required is taking very long time (2000s elapsed and still not finished, so I killed it)
    The workaround for this is to add/subtract 1day (cause ARPEGE_WORLD grib files has 24h range) to the filter date range, and apply it to both 
    start_time and end_time. This will return more than what we need, but we can just filter what we don't need using javascript.
    
    Original Query (with fix to the bug found) for reference: SELECT * FROM  "WeatherDatas" WHERE NOT ("start_time" > filterEndTime OR "end_time" < filterStartTime)
    */
  //
  const startDate = new Date(startTime - 1000 * 60 * 60 * 24);
  const endDate = new Date(endTime + 1000 * 60 * 60 * 24);
  const allFiles = await db.weatherData.findAll({
    where: {
      model: { [Op.in]: modelsToFetch },
      start_time: {
        [Op.lte]: endDate,
        [Op.gte]: startDate,
      },
      end_time: {
        [Op.lte]: endDate,
        [Op.gte]: startDate,
      },
    },
    order: [['created_at', 'DESC']],
    raw: true,
  });

  // Filter non-useful gribs
  const files = allFiles.filter((file) => {
    const { start_time: gribStartTime, end_time: gribEndTime } = file;
    return !(
      gribStartTime.getTime() > endTime || gribEndTime.getTime() < startTime
    );
  });
  logger.info(`Fetched ${allFiles.length}, filtered down to: ${files.length}`);

  return this.removeRedundantFiles(files);
};

exports.processFunction = async (data) => {
  const {
    id,
    model,
    grib_file_url,
    bbox,
    searchStartTime,
    searchEndTime,
    raceID,
    sliceJson,
  } = data;
  const randomizedID = uuidv4();
  logger.info(`Processing ${raceID} | ${model} - ${id} -> ${randomizedID}`);
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

  if (!fs.existsSync(downloadPath)) {
    logger.error(
      `Download didn't fail, but file doesn't exist at download path. ID: ${id} / ${randomizedID}, timestamp: ${currentTime.toISOString()}`,
    );
    return [];
  }

  const targetFolder = path.resolve(
    __dirname,
    `../../operating_folder/${randomizedID}`,
  );
  try {
    await fs.promises.access(targetFolder);
  } catch (error) {
    await fs.promises.mkdir(targetFolder);
  }

  const { slicedGribs, geoJsons } = await sliceGribByRegion(
    bbox,
    downloadPath,
    {
      folder: targetFolder,
      fileID: randomizedID,
      model,
      searchStartTime,
      searchEndTime,
      sliceJson,
    },
  );

  const gribFiles = await uploadSlicedGribs(slicedGribs, {
    competitionUnitId: raceID,
    bboxString,
    originalFileId: id,
    model,
  });
  const jsonFiles = await uploadSlicedGeoJsons(geoJsons, {
    competitionUnitId: raceID,
    bboxString,
    originalFileId: id,
    model,
  });

  // Saving to DB
  const arrayData = [
    ...gribFiles.map((row) => {
      return {
        id: row.id,
        model,
        startTime: row.startTime,
        endTime: row.endTime,
        s3Key: row.s3Key,
        fileType: WEATHER_FILE_TYPES.grib,
        boundingBox: bboxPolygon.geometry,
        levels: row.levels,
        variables: row.variables,
        runtimes: row.runtimes,
        competitionUnitId: raceID,
        originalFileId: id,
        sliceDate: currentTime,
      };
    }),
    ...jsonFiles.map((row) => {
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

  return jsonFiles.map((row) => {
    return {
      key: row.s3Key,
      model,
      levels: row.levels,
      variables: row.variables,
      runtimes: row.runtimes,
    };
  });
};

exports.getArchivedData = async (
  { bbox, startTime, endTime, raceID, sliceJson },
  updateProgress = null,
) => {
  const bboxPolygon = turf.bboxPolygon(bbox);
  const files = await this.getWeatherFilesByRegion(
    bboxPolygon,
    startTime,
    endTime,
  );
  logger.info(`Competition ${raceID} has ${files.length} files to process.`);
  if (files.length === 0) {
    return [];
  }

  if (files.length > MAX_SLICE_FILE_COUNT) {
    const hasSkippedBefore = await skipSliceDAL.checkSkippedCompetition(raceID);
    if (!hasSkippedBefore) {
      if (updateProgress) {
        await updateProgress(0, {
          fileCount: files.length,
          processedFileCount: 0,
          lastTimestamp: Date.now(),
          isCanceled: true,
          message: `File exceeded slice limit of ${MAX_SLICE_FILE_COUNT}. Total files: ${files.length}`,
        });
      }
      logger.info(`Competition ${raceID} exceeds slice limit, skipping...`);
      return [];
    }

    logger.info(
      `Competition ${raceID} exceeds slice limit, but has been skipped before. Continue Slice process`,
    );
  }
  const results = [];
  for (let i = 0; i < files.length; i++) {
    try {
      const result = await this.processFunction({
        ...files[i],
        bbox,
        searchStartTime: startTime,
        searchEndTime: endTime,
        raceID,
        sliceJson,
      });
      results.push(result);
    } catch (error) {
      logger.error(
        `Error processing archived data for Competition: ${raceID} - File: ${files[i].model}|${files[i].id}`,
      );
      logger.error(error);
    }
    if (updateProgress) {
      await updateProgress(((i + 1) * 100) / files.length, {
        fileCount: files.length,
        processedFileCount: i + 1,
        lastTimestamp: Date.now(),
      });
    }
  }
  logger.info(`Done processing archived data for ${raceID}`);
  return results.flat();
};
