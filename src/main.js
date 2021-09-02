require('dotenv').config();

// const db = require('./models');

const logger = require('./logger');
const createServer = require('./server');
const port = process.env.PORT || 3000;

(async () => {
  try {
    const app = createServer();
    // await db.sequelize.sync();
    app.listen(port, () => {
      logger.info(`Geo Data Slicer has started! Listening on ${port}`);
    });
  } catch (error) {
    logger.error(`Error starting server: ${error.message}`);
  }
})();
