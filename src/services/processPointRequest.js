const axios = require('axios');
const turf = require('@turf/turf');

const {
  windfinderIndex,
  windfinderPoints,
  noaaBuoyIndex,
  noaaBuoyPoints,
} = require('./createSourceIndex');
const {
  getWeatherFilesByPoint,
  getArchivedDataByPoint,
} = require('./getArchivedData');
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
  const archivedPromise = new Promise(async (resolve) => {
    const downloadedFiles = await getWeatherFilesByPoint(
      point,
      startTimeUnixMS,
      endTimeUnixMS,
    );
    resolve(getArchivedDataByPoint(point, downloadedFiles));
  });

  const shipReportPromise = createShipReport(startTimeUnixMS, endTimeUnixMS);

  const [lon, lat] = point.geometry.coordinates;
  // This will get spots based on precise location
  // Will have to increase radius to allow less precision
  const spots = windfinderIndex
    .within(lon, lat, 0)
    .map((id) => windfinderPoints[id]);
  const windfinderPromise = createWindfinderWind(
    spots,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  // This will get spots based on precise location
  // Will have to increase radius to allow less precision
  const buoys = noaaBuoyIndex
    .within(lon, lat, 0)
    .map((id) => noaaBuoyPoints[id]);
  const noaaBuoyPromise = createNoaaBuoyWind(
    buoys,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  //   const [archivedData, shipReports, windfinderWinds, noaaBuoyWinds] =
  //     await Promise.all([
  //       archivedPromise,
  //       shipReportPromise,
  //       windfinderPromise,
  //       noaaBuoyPromise,
  //     ]);
  const archivedData = await archivedPromise;
  const windfinderWinds = await windfinderPromise;
  const noaaBuoyWinds = await noaaBuoyPromise;
  const shipReportsFull = await shipReportPromise;

  const shipReports = turf.nearestPoint(point, shipReportsFull);
  await axios({
    url: webhook,
    method: 'POST',
    data: {
      token: webhookToken,
      archivedData,
      shipReports,
      windfinderWinds,
      noaaBuoyWinds,
    },
  });
}

module.exports = processPointRequest;
