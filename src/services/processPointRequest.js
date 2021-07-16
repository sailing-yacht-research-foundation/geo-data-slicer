const axios = require('axios');
const turf = require('@turf/turf');
const geokdbush = require('geokdbush');

const {
  windfinderIndex,
  windfinderPoints,
  noaaBuoyIndex,
  noaaBuoyPoints,
} = require('./createSourceIndex');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');
const createNoaaBuoyWind = require('./createNoaaBuoyWind');

async function processPointRequest(
  point,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
) {
  const shipReportPromise = createShipReport(startTimeUnixMS, endTimeUnixMS);

  // TODO: Use geokdbush to find nearest after we scrape for windfinder and noaa buoys
  // Need to scrape first, cause what we get might not be weather station (windfinder, no data we want) or no data available for the past hours (buoy)
  const [lon, lat] = point.geometry.coordinates;
  // This will get spots based on precise location
  // Will have to increase radius to allow less precision
  // const spots = windfinderIndex
  //   .within(lon, lat, 0)
  //   .map((id) => windfinderPoints[id]);

  const nearestSpots = geokdbush.around(windfinderIndex, lon, lat, 200); // Shouldn't matter if we fetch 200 nearest here, below function should stop when a weather station is found
  const windfinderPromise = createWindfinderWind(
    nearestSpots,
    startTimeUnixMS,
    endTimeUnixMS,
    true, // stop when finding weather stations
  );

  // This will get spots based on precise location
  // Will have to increase radius to allow less precision
  // const buoys = noaaBuoyIndex
  //   .within(lon, lat, 0)
  //   .map((id) => noaaBuoyPoints[id]);
  const nearestBuoys = geokdbush.around(noaaBuoyIndex, lon, lat, 20);
  const noaaBuoyPromise = createNoaaBuoyWind(
    nearestBuoys,
    startTimeUnixMS,
    endTimeUnixMS,
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
      token: webhookToken,
      shipReports,
      windfinderWinds,
      noaaBuoyWinds,
    },
  });
}

module.exports = processPointRequest;
