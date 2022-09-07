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
};
