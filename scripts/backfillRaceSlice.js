require('dotenv').config();
const turf = require('@turf/turf');
const axios = require('axios');
const { setTimeout: sleep } = require('timers/promises');

const skipSliceDAL = require('../src/syrf-schema/dataAccess/v1/skippedCompetitionWeather');
const logger = require('../src/logger');
// TODO: Change this to dev/prod slicer for actual backfilling, impossible to run this in local as downloading gribs will be too slow
const slicerUrl = 'http://localhost:3000/api/v1';

(async () => {
  logger.info('Starting script');
  const nonSlicedCompetitions =
    await skipSliceDAL.getUnskippedUnslicedCompetition(10);
  logger.info(`Fetched ${nonSlicedCompetitions.length} races`);
  for (let i = 0; i < nonSlicedCompetitions.length; i++) {
    const { id, startTime, endTime, boundingBox } = nonSlicedCompetitions[i];
    try {
      await axios.post(slicerUrl, {
        roi: turf.polygon(boundingBox.coordinates),
        startTimeUnixMS: startTime.getTime(),
        endTimeUnixMS: endTime.getTime(),
        payload: {
          raceID: id,
        },
      });
      logger.info(`Competition ${id} has been queued into slicer`);
    } catch (err) {
      logger.info('Failed to queue into slicer, saving skip into DB');
      try {
        await skipSliceDAL.create({
          competitionUnitId: id,
          totalFileCount: 0,
          message: `Failed to queue into slicer by backfill script: ${err.message}`,
        });
      } catch (err) {
        logger.error(
          `Failed saving skipped competition record: ${err.message}`,
        );
      }
    }
    await sleep(200);
  }
})();
