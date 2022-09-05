const { Queue, Worker } = require('bullmq');
const { promisify } = require('util');
const execPromise = promisify(require('child_process').exec);
const dayjs = require('dayjs');
const path = require('path');
const fsPromise = require('fs/promises');
const turf = require('@turf/turf');
const { v4: uuidv4 } = require('uuid');

const logger = require('../logger');
const { WEATHER_FILE_TYPES } = require('../configs/general.config');
const { bullQueues, competitionUnitStatus } = require('../syrf-schema/enums');
const cuDAL = require('../syrf-schema/dataAccess/v1/competitionUnit');
const slicedWeatherDAL = require('../syrf-schema/dataAccess/v1/slicedWeather');

const utc = require('dayjs/plugin/utc');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
const {
  uploadSlicedGribs,
  uploadSlicedGeoJsons,
} = require('../services/uploadSlicedFiles');
const { MODELS } = require('../configs/sourceModel.config');
dayjs.extend(customParseFormat);
dayjs.extend(utc);

var era5Queue;

const setup = (connection) => {
  era5Queue = new Queue(bullQueues.era5Queue, {
    connection,
  });

  const worker = new Worker(
    bullQueues.era5Queue,
    async (job) => {
      if (!job.data) {
        logger.error(`No Data provided on slicer queue job ${job.id}`);
        return false;
      }
      logger.info(`Starting slice process. Job ID: ${job.id}`);

      const { competitionUnitId } = job.data;
      const competition = await cuDAL.getById(competitionUnitId);
      if (!competition) {
        throw new Error('Competition Not Found');
      }
      const thresholdDate = new Date();
      thresholdDate.setUTCDate(thresholdDate.getUTCDate() - 7);
      const { startTime, endTime, status, boundingBox } = competition;
      if (
        !endTime ||
        endTime > thresholdDate ||
        status !== competitionUnitStatus.COMPLETED ||
        boundingBox == null
      ) {
        throw new Error(
          'Competition not completed yet, or endTime/boundingBox is not set / too recent and ERA5 is not available yet',
        );
      }
      // Note: Must use python3.6 instead of python. The pip3 installation somehow is installing to that version, while pip installation goes to the conda
      // Options: `python xxx` (will run with conda), `/usr/bin/python xxx` (will run the python installed in the top line of docker), `python3.6` (not really sure how this is available and the working one)
      // Extra note: Cannot run this in dev mode (nodemon), running in node src/main.js should work. Seems the nodemon is not ran by root, therefore can't access the required .cdsapirc file in root folder
      // No resources on the python package mentioning custom cdsapirc location.
      try {
        logger.info('Starting python/cdsapi download script, please wait');
        await execPromise(
          `python3.6 pyscripts/downloadERA5.py ${competitionUnitId} ${dayjs
            .utc(startTime)
            .format('YYYYMMDDHHmmss')} ${dayjs
            .utc(endTime)
            .format('YYYYMMDDHHmmss')}`,
        );
      } catch (error) {
        console.trace(error);
        throw error;
      }

      const competitionDir = path.resolve(
        __dirname,
        `../../operating_folder/${competitionUnitId}`,
      );
      try {
        await fsPromise.access(competitionDir);
      } catch (error) {
        throw new Error('Competition Folder for ERA5 does not exist');
      }

      // Enlarge bbox to 1 degree resolution since most races' bbox are very small
      const bbox = turf.bbox(turf.polygon(boundingBox.coordinates));
      const leftLon = Math.floor(bbox[0]);
      const bottomLat = Math.floor(bbox[1]);
      const rightLon = Math.ceil(bbox[2]);
      const topLat = Math.ceil(bbox[3]);
      const containerBbox = [leftLon, bottomLat, rightLon, topLat];
      const bboxPolygon = turf.bboxPolygon(containerBbox);

      const files = await fsPromise.readdir(competitionDir);
      await job.updateProgress(50); // Download is done, so 50% is done.
      await job.update({
        ...job.data,
        metadata: {
          downloadedFileCount: files.length,
          parsedFileCount: 0,
          lastTimestamp: Date.now(),
        },
      });
      logger.info(`File downloaded count: ${files.length}`);
      for (let i = 0; i < files.length; i++) {
        if (!files[i].endsWith('.grib')) {
          continue;
        }

        const fileName = files[i].replace('.grib', '');
        logger.info(
          `Processing ${fileName} for competition ${competitionUnitId}`,
        );
        const randomizedID = uuidv4();
        const targetFolder = path.resolve(
          __dirname,
          `../../operating_folder/${randomizedID}`,
        );
        try {
          await fsPromise.access(targetFolder);
        } catch (error) {
          await fsPromise.mkdir(targetFolder);
        }
        try {
          /*
          Note on decision to keep using wgrib2 to slice ERA5 files
          1. The cdo sellonlatbox while successfully minify the original grib file, it generates a file that is not `wgrib` able, it throws error. (Need to retry with better environment, lots of test files are present, might use wrong file)
          2. Keeping it in GRIB1 format, we have to use grib_get_data to export into csv, and add another script to fix the generated csv (following the ecmwf documentation), which we will have to add some changes for our use case.
          3. The GRIB slicing part, we have to create a script that can work on grib1. It will also store sliced grib in version 1, which is different from other models, including ERA5 models previously provided in s3.
          4. Conversion from grib 1 to grib 2 turns out didn't have any loss of data. It's actually what Jon mentioned during the call, where US/Europe has different variable names and that's actually what's happening.
          */
          // Setting to grib version 2. Note: There's no need to add any definition to conversion, every data turns out has been mapped if we only use ECMWF, not wgrib2
          await execPromise(
            `grib_set -s edition=2 ${competitionDir}/${fileName}.grib ${competitionDir}/${fileName}.grb2`,
          );
          await fsPromise.unlink(`${competitionDir}/${fileName}.grib`);
          const { slicedGribs, geoJsons } = await sliceGribByRegion(
            containerBbox,
            `${competitionDir}/${fileName}.grb2`,
            {
              folder: targetFolder,
              fileID: randomizedID,
              model: MODELS.era5,
              searchStartTime: startTime.getTime(),
              searchEndTime: endTime.getTime(),
              sliceJson: true,
            },
          );
          const bboxString = containerBbox.join(',');

          const currentTime = new Date();
          logger.info(
            `Uploading gribs from processing ${fileName} of competition ${competitionUnitId}`,
          );
          const gribFiles = await uploadSlicedGribs(slicedGribs, {
            bboxString,
            competitionUnitId,
            originalFileId: null,
            model: MODELS.era5,
          });
          logger.info(
            `Uploading jsons from processing ${fileName} of competition ${competitionUnitId}`,
          );
          const jsonFiles = await uploadSlicedGeoJsons(geoJsons, {
            bboxString,
            competitionUnitId,
            originalFileId: null,
            model: MODELS.era5,
          });

          // Saving to DB
          const arrayData = [
            ...gribFiles.map((row) => {
              return {
                id: row.id,
                model: MODELS.era5,
                startTime: row.startTime,
                endTime: row.endTime,
                s3Key: row.s3Key,
                fileType: WEATHER_FILE_TYPES.grib,
                boundingBox: bboxPolygon.geometry,
                levels: row.levels,
                variables: row.variables,
                runtimes: row.runtimes,
                competitionUnitId,
                originalFileId: null,
                sliceDate: currentTime,
              };
            }),
            ...jsonFiles.map((row) => {
              return {
                id: row.uuid,
                model: MODELS.era5,
                startTime: row.startTime,
                endTime: row.endTime,
                s3Key: row.s3Key,
                fileType: WEATHER_FILE_TYPES.json,
                boundingBox: bboxPolygon.geometry,
                levels: row.levels,
                variables: row.variables,
                runtimes: row.runtimes,
                competitionUnitId,
                originalFileId: null,
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
            await fsPromise.rm(targetFolder, { recursive: true });
          } catch (error) {
            logger.error(`Error while cleaning up operation: ${error.message}`);
          }
        } catch (error) {
          logger.error(`Failed to process ERA5 File: ${error.message}`);
        }
        await job.updateProgress(50 + ((i + 1) * 50) / files.length);
        await job.update({
          ...job.data,
          metadata: {
            downloadedFileCount: files.length,
            parsedFileCount: i + 1,
            lastTimestamp: Date.now(),
          },
        });
      }

      // Cleanup ERA5 download folder
      try {
        await fsPromise.rm(competitionDir, { recursive: true });
      } catch (error) {
        logger.error(
          `Error while cleaning up ERA5 download directory: ${error.message}`,
        );
      }
      return true;
    },
    { connection, concurrency: 2 },
  );

  worker.on('failed', (job, err) => {
    logger.error(
      `ERA5 Download Queue job failed. JobID: [${job.id}], Error: ${err}`,
    );
  });
  worker.on('completed', (job) => {
    logger.info(`ERA5 Download job completed. JobID: [${job.id}]`);
  });
};

const addJob = async (data, opts) => {
  if (opts?.jobId) {
    await era5Queue.remove(opts.jobId);
  }
  await era5Queue.add(bullQueues.era5Queue, data, {
    removeOnFail: true,
    removeOnComplete: true,
    ...opts,
  });
  logger.info('Added new job to ERA5 download queue');
};

const removeJob = async (jobId) => {
  await era5Queue.remove(jobId);
};

const getQueueSize = async () => {
  const jobCount = await era5Queue.getJobCounts(
    'active',
    'waiting',
    'completed',
    'failed',
  );
  return jobCount;
};

const getActiveJobs = async () => {
  const activeJobs = await era5Queue.getJobs('active');
  return activeJobs;
};

module.exports = {
  setup,
  addJob,
  removeJob,
  getQueueSize,
  getActiveJobs,
};
