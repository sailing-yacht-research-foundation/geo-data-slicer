const axios = require('axios');
const turf = require('@turf/turf');

const {
  windfinderIndex,
  windfinderPoints,
  noaaBuoyIndex,
  noaaBuoyPoints,
} = require('./createSourceIndex');
const getArchivedData = require('./getArchivedData');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');
const createNoaaBuoyWind = require('./createNoaaBuoyWind');
const logger = require('../logger');

async function processRegionRequest(
  roi,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
  updateFrequencyMinutes,
  raceID,
) {
  const bbox = turf.bbox(roi);
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);
  const containerBbox = [leftLon, bottomLat, rightLon, topLat];

  const archivedPromise = getArchivedData(
    containerBbox,
    startTimeUnixMS,
    endTimeUnixMS,
    raceID,
  );

  const shipReportPromise = createShipReport(startTimeUnixMS, endTimeUnixMS);

  const spots = windfinderIndex
    .range(
      containerBbox[0],
      containerBbox[1],
      containerBbox[2],
      containerBbox[3],
    )
    .map((id) => windfinderPoints[id]);
  const windfinderPromise = createWindfinderWind(
    spots,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const buoys = noaaBuoyIndex
    .range(
      containerBbox[0],
      containerBbox[1],
      containerBbox[2],
      containerBbox[3],
    )
    .map((id) => noaaBuoyPoints[id]);
  const noaaBuoyPromise = createNoaaBuoyWind(
    buoys,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const [archivedData, shipReportsFull, windfinderWinds, noaaBuoyWinds] =
    await Promise.all([
      archivedPromise,
      shipReportPromise,
      windfinderPromise,
      noaaBuoyPromise,
    ]);

  const shipReports = turf.pointsWithinPolygon(
    shipReportsFull,
    turf.bboxPolygon(containerBbox),
  );
  try {
    await axios({
      url: webhook,
      method: 'POST',
      data: {
        raceID,
        token: webhookToken,
        archivedData,
        shipReports,
        windfinderWinds,
        noaaBuoyWinds,
      },
    });
  } catch (error) {
    logger.error(`Failed to send data to webhook. Error: ${error.message}`);
  }
}

module.exports = processRegionRequest;
