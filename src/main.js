require('dotenv').config();
const fsPromise = require('fs/promises');
const fsExtra = require('fs-extra');
const path = require('path');
const cron = require('node-cron');

const db = require('./models');
const { startDB } = require('./syrf-schema');
const { connect: redisConnect } = require('./queues');

const logger = require('./logger');
const createServer = require('./server');
const checkFinishedCompetitionERA5 = require('./services/checkFinishedCompetitionERA5');
const checkStuckQueue = require('./services/checkStuckQueue');
const automatedBackfillSlice = require('./services/automatedBackfillSlice');
const {
  AUTOMATED_SLICER_BACKFILL_MAX_QUEUE,
} = require('./configs/general.config');
const port = process.env.PORT || 3000;

(async () => {
  // Cleanup operating folder before starting up
  const operatingFolder = path.resolve(__dirname, `../operating_folder`);

  try {
    await fsPromise.access(operatingFolder);
  } catch (error) {
    await fsPromise.mkdir(operatingFolder);
  }
  try {
    await fsExtra.emptyDir(operatingFolder);
  } catch (error) {
    logger.error(
      `Error while cleaning operating folder on startup: ${error.message}`,
    );
  }
  try {
    const app = createServer();
    await Promise.all([db.startDB(), startDB(), redisConnect()]);
    app.listen(port, () => {
      cron.schedule('15 0 * * *', checkFinishedCompetitionERA5);
      cron.schedule('*/10 * * * *', checkStuckQueue);
      if (AUTOMATED_SLICER_BACKFILL_MAX_QUEUE > 0) {
        cron.schedule('39 * * * *', automatedBackfillSlice);
      }
      logger.info(`Geo Data Slicer has started! Listening on ${port}`);
    });
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`);
  }
})();
