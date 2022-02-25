const { Queue } = require('bullmq');
const logger = require('../logger');

const { bullQueues } = require('../syrf-schema/enums');

var calculateImportedQueue;

const setup = (connection) => {
  calculateImportedQueue = new Queue(bullQueues.calculateImport, {
    connection,
  });
};

const addJob = async (data, opts) => {
  if (opts?.jobId) {
    await calculateImportedQueue.remove(opts.jobId);
  }
  await calculateImportedQueue.add(bullQueues.calculateImport, data, {
    removeOnFail: true,
    removeOnComplete: true,
    ...opts,
  });
  logger.info('Added new job to import queue');
};

const removeJob = async (jobId) => {
  await calculateImportedQueue.remove(jobId);
};

module.exports = {
  setup,
  addJob,
  removeJob,
};
