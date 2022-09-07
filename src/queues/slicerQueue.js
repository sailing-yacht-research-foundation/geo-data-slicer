const { Queue, Worker } = require('bullmq');

const logger = require('../logger');
const db = require('../models');
const { CONCURRENT_SLICE_REQUEST } = require('../configs/general.config');
const { bullQueues } = require('../syrf-schema/enums');
const processRegionRequest = require('../services/processRegionRequest');
const {
  addNewSkippedCompetition,
} = require('../services/skipCompetitionService');

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
        sliceJson = true,
      } = job.data;

      // const durationToFetch = (startTimeUnixMS - endTimeUnixMS) / 3600000;
      // if (durationToFetch > 720) {
      //   // Over a month, skipping for now as it's going to be taking too long
      //   // Even a race with 1month duration will probably have at least 6k files to process
      //   logger.info(`Job for ${raceID} has been skipped, exiting...`);
      //   return true;
      // }
      const updateProgress = async (
        progValue,
        { fileCount, processedFileCount, lastTimestamp, message, isCanceled },
      ) => {
        await job.updateProgress(progValue);
        await job.update({
          ...job.data,
          metadata: {
            fileCount,
            processedFileCount,
            lastTimestamp,
            isCanceled,
            message,
          },
        });
      };
      await processRegionRequest(
        {
          roi,
          startTimeUnixMS,
          endTimeUnixMS,
          webhook,
          webhookToken,
          updateFrequencyMinutes,
          raceID,
          sliceJson,
        },
        updateProgress,
      );

      if (job.data.metadata?.isCanceled) {
        // This job is canceled from within
        await addNewSkippedCompetition({
          competitionUnitId,
          totalFileCount: job.data.metadata?.fileCount,
          message: job.data.metadata?.message,
        });
      }

      logger.info(`Job for ${raceID} has been finished, exiting...`);
      return true;
    },
    { connection, concurrency: CONCURRENT_SLICE_REQUEST },
  );

  worker.on('failed', (job, err) => {
    logger.error(`Slicer Queue job failed. JobID: [${job.id}], Error: ${err}`);
  });
  worker.on('completed', (job) => {
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

const getQueueSize = async () => {
  const jobCount = await slicerQueue.getJobCounts(
    'active',
    'waiting',
    'completed',
    'failed',
  );
  return jobCount;
};

const getActiveJobs = async () => {
  const activeJobs = await slicerQueue.getJobs('active');
  return activeJobs;
};

module.exports = {
  setup,
  addJob,
  removeJob,
  getQueueSize,
  getActiveJobs,
};
