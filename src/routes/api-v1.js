const express = require('express');

const validateRegionRequest = require('../middlewares/validateRegionRequest');
const validatePointRequest = require('../middlewares/validatePointRequest');

const processRegionRequest = require('../services/processRegionRequest');
const processPointRequest = require('../services/processPointRequest');

var router = express.Router();

/*
roi -> polygon
startTimeUnixMS -> millis
endTimeUnixMS -> millis
webhook -> url of webhook
webhookToken -> Auth of webhook?
updateFrequencyMinutes -> TODO: Are we going to use this, or just let analysis engine re-ping when they need the data
payload -> Adding this for race id, since right now we only save metadata without the race id. Other related data should be added here later.
*/
router.post('/', validateRegionRequest, async function (request, response) {
  const {
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    updateFrequencyMinutes,
    payload,
  } = request.body;

  // Payload
  const raceID = payload ? payload.raceID : null;

  processRegionRequest(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    updateFrequencyMinutes,
    raceID,
  );
  response.send('ok');
});

router.post('/point', validatePointRequest, async function (request, response) {
  const { point, startTimeUnixMS, endTimeUnixMS, webhook, webhookToken } =
    request.body;

  processPointRequest(
    point,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
  );
  response.send('ok');
});

module.exports = router;
