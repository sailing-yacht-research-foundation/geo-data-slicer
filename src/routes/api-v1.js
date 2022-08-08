const express = require('express');
const turf = require('@turf/turf');

const validateRegionRequest = require('../middlewares/validateRegionRequest');
const validatePointRequest = require('../middlewares/validatePointRequest');

const slicerQueue = require('../queues/slicerQueue');
const era5Queue = require('../queues/era5Queue');
const processPointRequest = require('../services/processPointRequest');
const logger = require('../logger');
const { MAX_AREA_CONCURRENT_RUN } = require('../configs/general.config');

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

  const bbox = turf.bbox(roi);
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);
  const containerBbox = [leftLon, bottomLat, rightLon, topLat];
  let sliceJson = true;
  const raceDuration = endTimeUnixMS - startTimeUnixMS;
  const monthInMs = 1000 * 60 * 60 * 24 * 30;
  // Large scraped race should skip json slices
  if (
    turf.area(turf.bboxPolygon(containerBbox)) > MAX_AREA_CONCURRENT_RUN ||
    raceDuration >= monthInMs
  ) {
    sliceJson = false;
  }
  slicerQueue.addJob(
    {
      roi,
      startTimeUnixMS,
      endTimeUnixMS,
      webhook,
      webhookToken,
      updateFrequencyMinutes,
      raceID,
      sliceJson,
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

router.post('/test', async function (request, response) {
  const { competitionUnitId } = request.body;

  era5Queue.addJob(
    {
      competitionUnitId,
    },
    { jobId: competitionUnitId },
  );
  response.send('ok');
  logger.info('Region request received & processed');
});

module.exports = router;
