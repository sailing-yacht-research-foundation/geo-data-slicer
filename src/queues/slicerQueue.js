const { Queue, Worker } = require('bullmq');
const path = require('path');

const logger = require('../logger');
const { CONCURRENT_SLICE_REQUEST } = require('../configs/general.config');
const { bullQueues } = require('../syrf-schema/enums');

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
