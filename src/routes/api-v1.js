const express = require('express');

const processRegionRequest = require('../services/processRegionRequest');

var router = express.Router();

router.post('/', async function (request, response) {
  const roi = request.body.roi;
  const startTimeUnixMS = request.body.startTimeUnixMS;
  const endTimeUnixMS = request.body.endTimeUnixMS;
  // Where should we send the data?
  const webhook = request.body.webhook;
  const webhookToken = request.body.webhookToken;

  // How often should we check the real time sources for new data?
  const updateFrequencyMinutes = request.body.updateFrequencyMinutes;

  processRegionRequest(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    updateFrequencyMinutes,
  );
  response.send('ok');
});

module.exports = router;
