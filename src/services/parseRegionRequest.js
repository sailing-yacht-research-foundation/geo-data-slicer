const turf = require('@turf/turf');

const { MAX_AREA_CONCURRENT_RUN } = require('../configs/general.config');
const slicerQueue = require('../queues/slicerQueue');

async function parseRegionRequest(data) {
  const {
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    updateFrequencyMinutes,
    payload,
  } = data;

  // Payload
  const raceID = payload ? payload.raceID : null;

  const bbox = turf.bbox(roi);
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);
  const containerBbox = [leftLon, bottomLat, rightLon, topLat];
  let sliceJson = true;
  const raceDuration = endTimeUnixMS - startTimeUnixMS;
  const monthInMs = 1000 * 60 * 60 * 24 * 30;
  // Large scraped race should skip json slices
  if (
    turf.area(turf.bboxPolygon(containerBbox)) > MAX_AREA_CONCURRENT_RUN ||
    raceDuration >= monthInMs
  ) {
    sliceJson = false;
  }
  slicerQueue.addJob(
    {
      roi,
      startTimeUnixMS,
      endTimeUnixMS,
      webhook,
      webhookToken,
      updateFrequencyMinutes,
      raceID,
      sliceJson,
    },
    raceID ? { jobId: raceID } : undefined,
  );
}

module.exports = parseRegionRequest;
