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
  // TODO: Figure out where to do the actual Puppeteer scraping.

  const archivedData = await getArchivedData(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const { shipReportsFeatureCollection } = await createShipReport();
  const containedShipReports = turf.pointsWithinPolygon(
    shipReportsFeatureCollection,
    roi,
  );
  const windfinderReports = await createWindfinderWind(roi);
  await axios({
    url: webhook,
    method: 'POST',
    data: {
      archivedData,
      containedShipReports,
      windfinderReports,
    },
  });
}

module.exports = processRegionRequest;
