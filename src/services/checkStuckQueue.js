const logger = require('../logger');
const era5Queue = require('../queues/era5Queue');
const slicerQueue = require('../queues/slicerQueue');
const {
  SLICING_STUCK_THRESHOLD,
  ERA5_STUCK_THRESHOLD,
  CONCURRENT_SLICE_REQUEST,
} = require('../configs/general.config');

const lastSlicerState = new Map();

async function checkStuckQueue() {
  logger.info('Checking Queues for stuck jobs');
  const eraActiveJobs = await era5Queue.getActiveJobs();
  const slicerActiveJobs = await slicerQueue.getActiveJobs();

  const eraJobsRemoved = [];
  for (const job of eraActiveJobs) {
    if (
      job.processedOn &&
      job.processedOn < Date.now() - ERA5_STUCK_THRESHOLD
    ) {
      await job.remove();
      eraJobsRemoved.push(job.id);
    }
  }
  if (eraJobsRemoved.length > 0) {
    logger.info(
      `${eraJobsRemoved.length} stuck active ERA5 jobs has been removed`,
    );
    logger.info(`Removed ID: ${eraJobsRemoved.join(',')}`);
  }

  // Cleanup map from no longer active jobs
  lastSlicerState.forEach((_val, key) => {
    if (slicerActiveJobs.findIndex((job) => job.id === key) === -1) {
      lastSlicerState.delete(key);
    }
  });
  const slicerJobsRemoved = [];
  let failedRemoveCount = 0;
  for (const job of slicerActiveJobs) {
    const { metadata } = job.data;
    if (metadata) {
      const { processedFileCount, lastTimestamp } = metadata;
      const previousState = lastSlicerState.get(job.id);
      if (
        previousState &&
        previousState.lastTimestamp === lastTimestamp &&
        previousState.processedFileCount === processedFileCount &&
        lastTimestamp < Date.now() - SLICING_STUCK_THRESHOLD
      ) {
        try {
          await job.remove();
          slicerJobsRemoved.push(job.id);
        } catch (error) {
          failedRemoveCount++;
          logger.error(
            `Failed to remove stuck job: ${job.id}. Error: ${error.message}`,
          );
        }
      } else {
        lastSlicerState.set(job.id, {
          lastTimestamp,
          processedFileCount,
        });
      }
    } else {
      // Leftover from previous instance/version, or somehow, the getArchivedData is never run
      if (
        job.processedOn &&
        job.processedOn < Date.now() - SLICING_STUCK_THRESHOLD
      ) {
        try {
          await job.remove();
          slicerJobsRemoved.push(job.id);
        } catch (error) {
          failedRemoveCount++;
          logger.error(
            `Failed to remove stuck job: ${job.id}. Error: ${error.message}`,
          );
        }
      }
    }
  }
  if (
    failedRemoveCount === slicerActiveJobs.length &&
    failedRemoveCount === CONCURRENT_SLICE_REQUEST
  ) {
    // All active jobs are stuck and can't be removed. Need to exit the slicer
    logger.info(
      `Exiting Slicer. All Slicer concurrent slot is used and can't be removed. Active Jobs: ${slicerActiveJobs
        .map((row) => row.id)
        .join(', ')}`,
    );
    process.exit(0);
  }
  if (slicerJobsRemoved.length > 0) {
    logger.info(
      `${slicerJobsRemoved.length} stuck active Slicer jobs has been removed`,
    );
    logger.info(`Removed ID: ${slicerJobsRemoved.join(',')}`);
  }
}

module.exports = checkStuckQueue;
