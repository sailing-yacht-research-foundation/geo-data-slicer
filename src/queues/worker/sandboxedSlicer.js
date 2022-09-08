const logger = require('../../logger');
const processRegionRequest = require('../../services/processRegionRequest');
const {
  addNewSkippedCompetition,
} = require('../../services/skipCompetitionService');

module.exports = async (job) => {
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

  const updateProgress = async (
    progressValue,
    { fileCount, processedFileCount, lastTimestamp, message, isCanceled },
  ) => {
    await job.updateProgress({
      progressValue,
      fileCount,
      processedFileCount,
      lastTimestamp,
      message,
      isCanceled,
    });
  };

  // Initial progress set, so the progress prop in healthcheck won't return a number
  await updateProgress(0, {
    fileCount: 0,
    processedFileCount: 0,
    lastTimestamp: Date.now(),
    message: '',
    isCanceled: false,
  });
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

  if (job.progress.isCanceled) {
    // This job is canceled from within
    await addNewSkippedCompetition({
      competitionUnitId,
      totalFileCount: job.data.metadata?.fileCount,
      message: job.data.metadata?.message,
    });
  }

  logger.info(`Job for ${raceID} has been finished, exiting...`);
  return true;
};
