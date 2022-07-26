const express = require('express');

const validateRegionRequest = require('../middlewares/validateRegionRequest');
const validatePointRequest = require('../middlewares/validatePointRequest');

const slicerQueue = require('../queues/slicerQueue');
const processPointRequest = require('../services/processPointRequest');
const logger = require('../logger');

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

  slicerQueue.addJob(
    {
      roi,
      startTimeUnixMS,
      endTimeUnixMS,
      webhook,
      webhookToken,
      updateFrequencyMinutes,
      raceID,
    },
    raceID ? { jobId: raceID } : undefined,
  );
  response.send('ok');
  logger.info('Region request received & processed');
});

router.post('/point', validatePointRequest, async function (request, response) {
  const {
    point,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    payload,
  } = request.body;

  // Payload
  const raceID = payload ? payload.raceID : null;

  processPointRequest(
    point,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    raceID,
  );
  response.send('ok');
  logger.info('Point request received & processed');
});

module.exports = router;
