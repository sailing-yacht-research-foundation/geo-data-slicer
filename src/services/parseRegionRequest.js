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

  slicerQueue.addJob(
    {
      roi,
      startTimeUnixMS,
      endTimeUnixMS,
      webhook,
      webhookToken,
      updateFrequencyMinutes,
      raceID,
      sliceJson: false, // Skip slice JSON for all, slicer instance will be taken down after backfill completes, and we don't want the json in the backfill
    },
    raceID ? { jobId: raceID } : undefined,
  );
}

module.exports = parseRegionRequest;
