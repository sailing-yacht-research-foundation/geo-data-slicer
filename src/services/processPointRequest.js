const axios = require('axios');
const turf = require('@turf/turf');
const geokdbush = require('geokdbush');

const { windfinderIndex, noaaBuoyIndex } = require('./createSourceIndex');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');
const createNoaaBuoyWind = require('./createNoaaBuoyWind');

async function processPointRequest(
  point,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
  raceID,
) {
  const shipReportPromise = createShipReport(startTimeUnixMS, endTimeUnixMS);

  const [lon, lat] = point.geometry.coordinates;

  const nearestSpots = geokdbush.around(windfinderIndex, lon, lat, 200); // Shouldn't matter if we fetch 200 nearest here, below function should stop when a weather station is found
  const windfinderPromise = createWindfinderWind(
    nearestSpots,
    startTimeUnixMS,
    endTimeUnixMS,
    true, // stop when a weather station is found
  );

  const nearestBuoys = geokdbush.around(noaaBuoyIndex, lon, lat, 20);
  const noaaBuoyPromise = createNoaaBuoyWind(
    nearestBuoys,
    startTimeUnixMS,
    endTimeUnixMS,
    true,
  );

  const [shipReportsFull, windfinderWinds, noaaBuoyWinds] = await Promise.all([
    shipReportPromise,
    windfinderPromise,
    noaaBuoyPromise,
  ]);

  let shipReports = shipReportsFull;
  if (shipReportsFull.features.length > 0) {
    shipReports = turf.nearestPoint(point, shipReportsFull);
  }

  await axios({
    url: webhook,
    method: 'POST',
    data: {
      raceID,
      token: webhookToken,
      shipReports,
      windfinderWinds,
      noaaBuoyWinds,
    },
  });
}

module.exports = processPointRequest;
