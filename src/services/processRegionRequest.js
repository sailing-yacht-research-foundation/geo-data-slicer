const turf = require('@turf/turf');
const axios = require('axios');

const getArchivedData = require('./getArchivedData');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');

async function processRegionRequest(
  roi,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
  updateFrequencyMinutes,
) {
  const archivedData = await getArchivedData(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const currentTime = new Date().getTime();
  const twelveHoursAgo = currentTime - 1000 * 60 * 60 * 12;
  let shipReports = null;
  // We have no data available beyond these
  if (!(startTimeUnixMS > currentTime || endTimeUnixMS < twelveHoursAgo)) {
    const { shipReportsFeatureCollection } = await createShipReport(
      startTimeUnixMS,
      endTimeUnixMS,
    );
    shipReports = turf.pointsWithinPolygon(shipReportsFeatureCollection, roi);
  }

  const windfinderReports = await createWindfinderWind(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );
  await axios({
    url: webhook,
    method: 'POST',
    data: {
      archivedData,
      shipReports,
      windfinderReports,
    },
  });
}

module.exports = processRegionRequest;
