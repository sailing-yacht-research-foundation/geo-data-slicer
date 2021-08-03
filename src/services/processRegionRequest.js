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

async function processRegionRequest(
  roi,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
  updateFrequencyMinutes,
  raceID,
) {
  const archivedPromise = getArchivedData(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    raceID,
  );

  const shipReportPromise = createShipReport(startTimeUnixMS, endTimeUnixMS);

  const bbox = turf.bbox(roi);

  const spots = windfinderIndex
    .range(bbox[0], bbox[1], bbox[2], bbox[3])
    .map((id) => windfinderPoints[id]);
  const windfinderPromise = createWindfinderWind(
    spots,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const buoys = noaaBuoyIndex
    .range(bbox[0], bbox[1], bbox[2], bbox[3])
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

  const shipReports = turf.pointsWithinPolygon(shipReportsFull, roi);
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
}

module.exports = processRegionRequest;
