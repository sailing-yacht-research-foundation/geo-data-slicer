const express = require('express');

const apiV1 = require('./routes/api-v1');
const healthcheckRoutes = require('./routes/healthcheck');

function createServer() {
  const app = express();
  app.use(express.json());

  app.get('/', async (req, res) => {
    res.send('SYRF - Geo Data Slicer');
  });

  app.use('/api/v1', apiV1);
  app.use('/health', healthcheckRoutes);
  return app;
}

module.exports = createServer;
