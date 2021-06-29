require('dotenv').config();

const db = require('./models');
const { createShipReport } = require('./services/featureCollections');

const createServer = require('./server');
const port = process.env.PORT || 3000;

(async () => {
  try {
    const app = createServer();
    await db.sequelize.sync();
    await createShipReport();
    app.listen(port, () => {
      console.log(`Geo Data Slicer has started! Listening on ${port}`);
    });
  } catch (error) {
    console.log(error);
  }
})();
