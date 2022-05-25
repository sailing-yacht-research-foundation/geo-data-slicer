require('dotenv').config();
const fsExtra = require('fs-extra');
const path = require('path');

const db = require('./models');
const { startDB } = require('./syrf-schema');
const { connect: redisConnect } = require('./queues');

const logger = require('./logger');
const createServer = require('./server');
const port = process.env.PORT || 3000;

(async () => {
  // Cleanup operating folder before starting up
  const operatingFolder = path.resolve(__dirname, `../operating_folder`);
  try {
    fsExtra.emptyDir(operatingFolder);
  } catch (error) {
    logger.error(
      `Error while cleaning operating folder on startup: ${error.message}`,
    );
  }
  try {
    const app = createServer();
    await Promise.all([db.startDB(), startDB(), redisConnect()]);

    app.listen(port, () => {
      logger.info(`Geo Data Slicer has started! Listening on ${port}`);
    });
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`);
  }
})();
