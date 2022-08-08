const { Queue, Worker } = require('bullmq');
const { promisify } = require('util');
const execPromise = promisify(require('child_process').exec);
const dayjs = require('dayjs');
const path = require('path');
const fsPromise = require('fs/promises');
const turf = require('@turf/turf');
const { v4: uuidv4 } = require('uuid');

const logger = require('../logger');
const { CONCURRENT_SLICE_REQUEST } = require('../configs/general.config');
const { bullQueues, competitionUnitStatus } = require('../syrf-schema/enums');
const cuDAL = require('../syrf-schema/dataAccess/v1/competitionUnit');
const processRegionRequest = require('../services/processRegionRequest');

const customParseFormat = require('dayjs/plugin/customParseFormat');
const sliceGribByRegion = require('../utils/sliceGribByRegion');
dayjs.extend(customParseFormat);

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
      // TODO: validates if endTime is set and before the threshold of ERA5 availability (6 days, 1 week for added threshold)
      const thresholdDate = new Date();
      thresholdDate.setUTCDate(thresholdDate.getUTCDate() - 7);
      const { startTime, endTime, status, boundingBox } = competition;
      if (
        !endTime ||
        endTime > thresholdDate ||
        status !== competitionUnitStatus.COMPLETED
      ) {
        console.log(endTime, thresholdDate, status);
        throw new Error(
          'Competition not completed yet, or endTime is not set / too recent and ERA5 is not available yet',
        );
      }

      console.log(
        `${startTime} - ${endTime} ${dayjs(startTime).format(
          'YYYYMMDDHHmmss',
        )} ${dayjs(endTime).format('YYYYMMDDHHmmss')}`,
      );
      //2016-07-09 12:14:00+00	2016-07-09 12:25:18+00
      // Note: Must use python3.6 instead of python. The pip3 installation somehow is installing to that version, while pip installation goes to the conda
      // Options: `python xxx` (will run with conda), `/usr/bin/python xxx` (will run the python installed in the top line of docker), `python3.6` (not really sure how this is available and the working one)
      // Extra note: Cannot run this in dev mode (nodemon), running in node src/main.js should work. Seems the nodemon is not ran by root, therefore can't access the required .cdsapirc file in root folder
      // No resources on the python package mentioning custom cdsapirc location.

      try {
        await execPromise(
          `python3.6 pyscripts/downloadERA5.py ${competitionUnitId} ${dayjs(
            startTime,
          ).format('YYYYMMDDHHmmss')} ${dayjs(endTime).format(
            'YYYYMMDDHHmmss',
          )}`,
        );
      } catch (error) {
        console.trace(error);
        throw error;
      }

      const competitionDir = path.resolve(
        __dirname,
        `../../pyscripts/${competitionUnitId}`,
      );
      try {
        await fsPromise.access(competitionDir);
      } catch (error) {
        throw new Error('Competition Folder for ERA5 does not exist');
      }

      const bbox = turf.bbox(turf.polygon(boundingBox.coordinates));
      const files = await fsPromise.readdir(competitionDir);
      console.log('file count', files.length);
      for (let i = 0; i < files.length; i++) {
        if (!files[i].endsWith('.grib')) {
          continue;
        }
        console.log('Doing', files[i]);
        const randomizedID = uuidv4();
        const fileName = files[i];
        const targetFolder = path.resolve(
          __dirname,
          `../../operating_folder/${randomizedID}`,
        );
        const { slicedGribs, geoJsons } = await sliceGribByRegion(
          bbox,
          `${competitionDir}/${fileName}`,
          {
            folder: targetFolder,
            fileID: randomizedID,
            model: 'ERA5',
            searchStartTime: startTime.getTime(),
            searchEndTime: endTime.getTime(),
            sliceJson: true,
          },
        );
      }
      return true;
    },
    { connection, concurrency: 2 }, // TODO: Check whether we can run the python script concurrently. Should be able since the script now creates a new folder for each competition
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

module.exports = {
  setup,
  addJob,
  removeJob,
};
