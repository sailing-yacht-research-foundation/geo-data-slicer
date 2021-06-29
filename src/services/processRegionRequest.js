const turf = require("@turf/turf");
const axios = require("axios");

const {
  sailFlowSpotFeatureCollection,
  noaaBuoyFeatureCollection,
  windfinderFeatureCollection,
  createShipReport,
} = require("./featureCollections");
const getArchivedData = require("./getArchivedData");

async function processRegionRequest(
  roi,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
  updateFrequencyMinutes
) {
  // TODO: Figure out where to do the actual Puppeteer scraping.

  const archivedData = await getArchivedData(
    roi,
    startTimeUnixMS,
    endTimeUnixMS
  );
  await axios({
    url: webhook,
    method: "POST",
    data: {
      archivedData,
    },
  });
  const { shipReportsFeatureCollection } = await createShipReport();
  const containedShipReports = turf.pointsWithinPolygon(
    shipReportsFeatureCollection,
    roi
  );
  const containedNoaaBuoys = turf.pointsWithinPolygon(
    noaaBuoyFeatureCollection,
    roi
  );
  const containedSailflowSpots = turf.pointsWithinPolygon(
    sailFlowSpotFeatureCollection,
    roi
  );
  const containedWindfinderPoints = turf.pointsWithinPolygon(
    windfinderFeatureCollection,
    roi
  );
}

module.exports = processRegionRequest;
