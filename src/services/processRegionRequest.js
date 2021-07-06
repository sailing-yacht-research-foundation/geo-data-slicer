const turf = require('@turf/turf');
const axios = require('axios');

const {
  sailFlowSpotFeatureCollection,
  noaaBuoyFeatureCollection,
  windfinderFeatureCollection,
} = require('./featureCollections');
const getArchivedData = require('./getArchivedData');
const createShipReport = require('./createShipReport');

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
  await axios({
    url: webhook,
    method: 'POST',
    data: {
      archivedData,
      containedShipReports,
    },
  });

  const containedNoaaBuoys = turf.pointsWithinPolygon(
    noaaBuoyFeatureCollection,
    roi,
  );
  const containedSailflowSpots = turf.pointsWithinPolygon(
    sailFlowSpotFeatureCollection,
    roi,
  );
  const containedWindfinderPoints = turf.pointsWithinPolygon(
    windfinderFeatureCollection,
    roi,
  );
}

module.exports = processRegionRequest;
