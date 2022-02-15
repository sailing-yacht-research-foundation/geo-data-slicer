require('dotenv').config();

const db = require('./models');
const { startDB } = require('./syrf-schema');
const { connect: redisConnect } = require('./queues');

const logger = require('./logger');
const createServer = require('./server');
const port = process.env.PORT || 3000;

(async () => {
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
