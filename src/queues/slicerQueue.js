const { Queue, Worker } = require('bullmq');
const path = require('path');

const logger = require('../logger');
const { CONCURRENT_SLICE_REQUEST } = require('../configs/general.config');
const { bullQueues, dataSources } = require('../syrf-schema/enums');
const calculateImportedQueue = require('./calculateImportedQueue');
const recalculateQueue = require('./recalculateQueue');

var slicerQueue;

const setup = (connection) => {
  slicerQueue = new Queue(bullQueues.slicerQueue, {
    connection,
  });

  const sandboxedSlicer = path.join(__dirname, './worker/sandboxedSlicer.js');

  const worker = new Worker(bullQueues.slicerQueue, sandboxedSlicer, {
    connection,
    concurrency: CONCURRENT_SLICE_REQUEST,
  });

  worker.on('failed', (job, err) => {
    logger.error(`Slicer Queue job failed. JobID: [${job.id}], Error: ${err}`);
    console.trace(err);
  });
  worker.on('completed', (job, result) => {
    logger.info(
      `Slicer Queue job completed. JobID: [${job.id}]. Proceeding with recalculate check.`,
    );
    if (result?.source && result.source !== dataSources.SYRF) {
      const { source, slicedWeatherCount } = result;
      logger.info(
        `Competition ${job.id} is a scraped/imported track, checking sliced count.`,
      );
      // Make it only added to recalculate queue if there are weather data sliced, since recalculate without weather will result in similar data
      if (slicedWeatherCount > 0) {
        logger.info(
          `Competition ${job.id} has ${slicedWeatherCount} sliced file, proceed to recalculate queue`,
        );
        switch (source) {
          case dataSources.IMPORT: {
            // Imported tracks, add job to calculate import queue (AE Regular mode, running in dev)
            calculateImportedQueue.addJob(
              {
                competitionUnitId: job.id,
              },
              { jobId: job.id },
            );
            break;
          }
          default: {
            // Scraped races, add job to recalculate queue (AE Recalculate mode)
            recalculateQueue.addJob(
              {
                competitionUnitId: job.id,
                recalculateWeather: true,
              },
              { jobId: job.id },
            );
            break;
          }
        }
      }
    }
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
