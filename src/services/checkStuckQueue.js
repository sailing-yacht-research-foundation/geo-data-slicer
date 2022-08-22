const logger = require('../logger');
const era5Queue = require('../queues/era5Queue');
const slicerQueue = require('../queues/slicerQueue');
const {
  SLICING_STUCK_THRESHOLD,
  ERA5_STUCK_THRESHOLD,
} = require('../configs/general.config');

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

  const slicerJobsRemoved = [];
  for (const job of slicerActiveJobs) {
    if (
      job.processedOn &&
      job.processedOn < Date.now() - SLICING_STUCK_THRESHOLD
    ) {
      try {
        await job.remove();
        slicerJobsRemoved.push(job.id);
      } catch (error) {
        logger.error(
          `Failed to remove stuck job: ${job.id}. Error: ${error.message}`,
        );
      }
    }
  }
  if (slicerJobsRemoved.length > 0) {
    logger.info(
      `${slicerJobsRemoved.length} stuck active Slicer jobs has been removed`,
    );
    logger.info(`Removed ID: ${slicerJobsRemoved.join(',')}`);
  }
}

module.exports = checkStuckQueue;
