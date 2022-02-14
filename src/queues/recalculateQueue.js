const { Queue } = require('bullmq');
const logger = require('../logger');

const { bullQueues } = require('../syrf-schema/enums');

var recalculateQueue;

const setup = (connection) => {
  recalculateQueue = new Queue(bullQueues.recalculateTrack, {
    connection,
  });
};

const addJob = async (data, opts) => {
  if (opts?.jobId) {
    await recalculateQueue.remove(opts.jobId);
  }
  await recalculateQueue.add(bullQueues.recalculateTrack, data, {
    removeOnFail: true,
    removeOnComplete: true,
    ...opts,
  });
  logger.info('Added new job to recalculate queue');
};

const removeJob = async (jobId) => {
  await recalculateQueue.remove(jobId);
};

module.exports = {
  setup,
  addJob,
  removeJob,
};
