const turf = require('@turf/turf');

const skipSliceDAL = require('../syrf-schema/dataAccess/v1/skippedCompetitionWeather');
const logger = require('../logger');
const slicerQueue = require('../queues/slicerQueue');
const {
  AUTOMATED_SLICER_BACKFILL_MAX_QUEUE,
} = require('../configs/general.config');
const parseRegionRequest = require('./parseRegionRequest');

async function automatedBackfillSlice() {
  logger.info('=== AUTOMATED BACKFILL STARTING ===');

  const slicerQueueInfo = await slicerQueue.getQueueSize();
  const totalRaceInQueue =
    Number(slicerQueueInfo.active) + Number(slicerQueueInfo.waiting);

  if (totalRaceInQueue < AUTOMATED_SLICER_BACKFILL_MAX_QUEUE) {
    // Run backfill
    const nonSlicedCompetitions =
      await skipSliceDAL.getUnskippedUnslicedCompetition(
        2 * AUTOMATED_SLICER_BACKFILL_MAX_QUEUE,
      );
    logger.info(`AUTOBACKFILL: Fetched ${nonSlicedCompetitions.length} races`);
    for (let i = 0; i < nonSlicedCompetitions.length; i++) {
      const { id, startTime, endTime, boundingBox } = nonSlicedCompetitions[i];

      try {
        parseRegionRequest({
          roi: turf.polygon(boundingBox.coordinates),
          startTimeUnixMS: startTime.getTime(),
          endTimeUnixMS: endTime.getTime(),
          payload: {
            raceID: id,
          },
        });
      } catch (err) {
        logger.info(
          `AUTOBACKFILL: Failed to queue ${id} into slicer, saving skip into DB`,
        );
        try {
          await skipSliceDAL.create({
            competitionUnitId: id,
            totalFileCount: 0,
            message: `Failed to queue into slicer by automated backfill script: ${err.message}`,
          });
        } catch (err) {
          logger.error(
            `AUTOBACKFILL: Failed saving skipped competition record: ${err.message}`,
          );
        }
      }
    }
  } else {
    logger.info(
      `AUTOBACKFILL: Slicer Queue currently has ${totalRaceInQueue} in queue, backfilling will be skipped`,
    );
  }

  logger.info('=== AUTOMATED BACKFILL DONE ===');
}

module.exports = automatedBackfillSlice;
