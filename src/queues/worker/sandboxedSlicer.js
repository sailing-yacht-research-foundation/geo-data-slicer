const logger = require('../../logger');
const processRegionRequest = require('../../services/processRegionRequest');
const skipSliceDAL = require('../../syrf-schema/dataAccess/v1/skippedCompetitionWeather');

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

  // Can't access .progress, storing in this variable instead.
  let progressData = {
    progressValue: 0,
    fileCount: 0,
    processedFileCount: 0,
    lastTimestamp: Date.now(),
    message: '',
    isCanceled: false,
  };

  const updateProgress = async (
    progressValue,
    { fileCount, processedFileCount, lastTimestamp, message, isCanceled },
  ) => {
    progressData = {
      progressValue,
      fileCount,
      processedFileCount,
      lastTimestamp,
      message,
      isCanceled,
    };
    await job.updateProgress({
      progressValue,
      fileCount,
      processedFileCount,
      lastTimestamp,
    });
  };

  // Initial progress set, so the progress prop in healthcheck won't return a number
  await updateProgress(0, {
    fileCount: 0,
    processedFileCount: 0,
    lastTimestamp: Date.now(),
  });
  const result = await processRegionRequest(
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

  if (progressData.isCanceled) {
    try {
      await skipSliceDAL.create({
        competitionUnitId: raceID,
        totalFileCount: progressData.fileCount ?? 0,
        message: progressData.message ?? 'Canceled (no message provided)',
      });
    } catch (err) {
      logger.error(`Failed saving skipped competition record: ${err.message}`);
    }
  }

  logger.info(`Job for ${raceID} has been finished, exiting...`);
  return result;
};
