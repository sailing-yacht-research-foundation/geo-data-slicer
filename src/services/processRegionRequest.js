const axios = require('axios');
const turf = require('@turf/turf');

const {
  windfinderIndex,
  windfinderPoints,
  noaaBuoyIndex,
  noaaBuoyPoints,
} = require('./createSourceIndex');
const { getArchivedData } = require('./getArchivedData');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');
const createNoaaBuoyWind = require('./createNoaaBuoyWind');
const weatherSourceToFeatureCollection = require('../utils/weatherSourceToFeatureCollection');
const competitionDAL = require('../syrf-schema/dataAccess/v1/competitionUnit');
const { dataSources } = require('../syrf-schema/enums');
const { MAX_AREA_CONCURRENT_RUN } = require('../configs/general.config');
const recalculateQueue = require('../queues/recalculateQueue');
const calculateImportedQueue = require('../queues/calculateImportedQueue');
const logger = require('../logger');

async function processRegionRequest(
  {
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    updateFrequencyMinutes,
    raceID,
    sliceJson = true,
  },
  updateProgress = null,
) {
  const bbox = turf.bbox(roi);
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);
  const containerBbox = [leftLon, bottomLat, rightLon, topLat];

  const competitionDetail = await competitionDAL.getById(raceID);

  const archivedPromise = getArchivedData(
    {
      bbox: containerBbox,
      startTime: startTimeUnixMS,
      endTime: endTimeUnixMS,
      raceID,
      sliceJson,
    },
    updateProgress,
  );

  let shipReportPromise = null;
  let windfinderPromise = null;
  let noaaBuoyPromise = null;
  if (
    (competitionDetail?.calendarEvent &&
      competitionDetail.calendarEvent.source !== dataSources.SYRF) ||
    turf.area(turf.bboxPolygon(containerBbox)) > MAX_AREA_CONCURRENT_RUN
  ) {
    windfinderPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(weatherSourceToFeatureCollection([]));
      }, 1000);
    });
    noaaBuoyPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(weatherSourceToFeatureCollection([]));
      }, 1000);
    });
    shipReportPromise = new Promise((resolve) => {
      setTimeout(() => {
        resolve(weatherSourceToFeatureCollection([]));
      }, 1000);
    });
  } else {
    shipReportPromise = createShipReport(startTimeUnixMS, endTimeUnixMS);
    const spots = windfinderIndex
      .range(
        containerBbox[0],
        containerBbox[1],
        containerBbox[2],
        containerBbox[3],
      )
      .map((id) => windfinderPoints[id]);
    windfinderPromise = createWindfinderWind(
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
    noaaBuoyPromise = createNoaaBuoyWind(buoys, startTimeUnixMS, endTimeUnixMS);
  }

  const [archivedData, shipReportsFull, windfinderWinds, noaaBuoyWinds] =
    await Promise.all([
      archivedPromise,
      shipReportPromise,
      windfinderPromise,
      noaaBuoyPromise,
    ]);
  logger.info(
    `Competition ${raceID} has finished all data collection, proceeding to queue for other job/webhooks`,
  );

  const shipReports = turf.pointsWithinPolygon(
    shipReportsFull,
    turf.bboxPolygon(containerBbox),
  );

  // If source is not from syrf
  if (
    competitionDetail?.calendarEvent &&
    competitionDetail.calendarEvent.source !== dataSources.SYRF
  ) {
    logger.info(
      `Competition ${raceID} is a scraped/imported track, adding recalculation queue`,
    );
    // Make it only added to recalculate queue if there are weather data sliced, since recalculate without weather will result in similar data
    if (archivedData.length !== 0) {
      switch (competitionDetail.calendarEvent.source) {
        case dataSources.IMPORT: {
          // Imported tracks, add job to calculate import queue (AE Regular mode, running in dev)
          calculateImportedQueue.addJob(
            {
              competitionUnitId: raceID,
            },
            { jobId: raceID },
          );
          break;
        }
        default: {
          // Scraped races, add job to recalculate queue (AE Recalculate mode)
          // Note: This is disabled in dev
          recalculateQueue.addJob(
            {
              competitionUnitId: raceID,
              recalculateWeather: true,
            },
            { jobId: raceID },
          );
          break;
        }
      }
    }
  } else if (webhook) {
    // Skipping webhook if it's imported/scraped track
    logger.info(`Sending webhook to ${webhook}. Race ID: ${raceID}`);
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
      // Adding more info to see what webhook url is the payload failing 404 to.
      logger.error(
        `Failed to send data to webhook [${webhook}] for competition: ${raceID} from event (${competitionDetail?.calendarEvent.name}). Error: ${error.message}`,
      );
      if (error.response) {
        logger.error(JSON.stringify(error.response.data));
      }
    }
  }
  // Still had issue with some job stay in active queue (mostly during deployment, but those can be removed)
  // Not sure why, the logs from dev/prod both has reached the log above (is a scraped/imported track etc) and no error logged
  // https://github.com/OptimalBits/bull/issues/1766 Following the recommendation to add log here and in the job right before returning
  logger.info(`Competition ${raceID} has been processed`);
}

module.exports = processRegionRequest;
