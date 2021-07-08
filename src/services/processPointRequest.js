const axios = require('axios');
const turf = require('@turf/turf');

const { windfinderIndex, windfinderPoints } = require('./createSourceIndex');
const getArchivedData = require('./getArchivedData');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');
const createNoaaBuoyWind = require('./createNoaaBuoyWind');

async function processPointRequest(point, time, webhook, webhookToken) {
  const roi = turf.circle(point, 1, { steps: 10, units: 'kilometers' });
  const bbox = turf.bbox(roi);

  //   const archivedPromise = getArchivedData(roi, startTimeUnixMS, endTimeUnixMS);
  //   const shipReportPromise = createShipReport(
  //     roi,
  //     startTimeUnixMS,
  //     endTimeUnixMS,
  //   );

  const [lon, lat] = point.geometry.coordinates;
  // This will get spots based on precise location
  // Will have to increase radius to allow less precision
  const spots = windfinderIndex
    .within(lon, lat, 0)
    .map((id) => windfinderPoints[id]);
  const windfinderPromise = createWindfinderWind(spots, time, time);

  //   const noaaBuoyPromise = createNoaaBuoyWind(
  //     roi,
  //     startTimeUnixMS,
  //     endTimeUnixMS,
  //   );

  //   const [archivedData, shipReports, windfinderWinds, noaaBuoyWinds] =
  //     await Promise.all([
  //       archivedPromise,
  //       shipReportPromise,
  //       windfinderPromise,
  //       noaaBuoyPromise,
  //     ]);
  const windfinderWinds = await windfinderPromise;

  await axios({
    url: webhook,
    method: 'POST',
    data: {
      token: webhookToken,
      //   archivedData,
      //   shipReports,
      windfinderWinds,
      //   noaaBuoyWinds,
    },
  });
}

module.exports = processPointRequest;
