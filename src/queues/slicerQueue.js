const { Queue, Worker } = require('bullmq');
const logger = require('../logger');

const { CONCURRENT_SLICE_REQUEST } = require('../configs/general.config');
const { bullQueues } = require('../syrf-schema/enums');
const processRegionRequest = require('../services/processRegionRequest');

var slicerQueue;

const setup = (connection) => {
  slicerQueue = new Queue(bullQueues.slicerQueue, {
    connection,
  });

  const worker = new Worker(
    bullQueues.slicerQueue,
    async (job) => {
      if (!job.data) {
        logger.error(`No Data provided on slicer queue job ${job.id}`);
        return false;
      }
      logger.info(`Starting slice process. Job ID: ${job.id}`);

      const {
        roi,
        startTimeUnixMS,
        endTimeUnixMS,
        webhook,
        webhookToken,
        updateFrequencyMinutes,
        raceID,
      } = job.data;

      await processRegionRequest(
        roi,
        startTimeUnixMS,
        endTimeUnixMS,
        webhook,
        webhookToken,
        updateFrequencyMinutes,
        raceID,
      );

      return true;
    },
    { connection, concurrency: CONCURRENT_SLICE_REQUEST },
  );

  worker.on('failed', (job, err) => {
    logger.error(`Slicer Queue job failed. JobID: [${job.id}], Error: ${err}`);
  });
  worker.on('completed', (job) => {
    job.remove();
    logger.info(`Slicer Queue job completed. JobID: [${job.id}]`);
  });
};

const addJob = async (data, opts) => {
  if (opts?.jobId) {
    await slicerQueue.remove(opts.jobId);
  }
  await slicerQueue.add(bullQueues.slicerQueue, data, {
    removeOnFail: true,
    removeOnComplete: true,
    ...opts,
  });
  logger.info('Added new job to slicer queue');
};

const removeJob = async (jobId) => {
  await slicerQueue.remove(jobId);
};

module.exports = {
  setup,
  addJob,
  removeJob,
};
