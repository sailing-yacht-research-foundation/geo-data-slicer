const axios = require('axios');
const turf = require('@turf/turf');

const { windfinderIndex, windfinderPoints } = require('./createSourceIndex');
const getArchivedData = require('./getArchivedData');
const createShipReport = require('./createShipReport');
const createWindfinderWind = require('./createWindfinderWind');
const createNoaaBuoyWind = require('./createNoaaBuoyWind');

async function processRegionRequest(
  roi,
  startTimeUnixMS,
  endTimeUnixMS,
  webhook,
  webhookToken,
  updateFrequencyMinutes,
) {
  const archivedPromise = getArchivedData(roi, startTimeUnixMS, endTimeUnixMS);

  const shipReportPromise = createShipReport(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const bbox = turf.bbox(roi);
  const spots = windfinderIndex
    .range(bbox[0], bbox[1], bbox[2], bbox[3])
    .map((id) => windfinderPoints[id]);
  const windfinderPromise = createWindfinderWind(
    spots,
    startTimeUnixMS,
    endTimeUnixMS,
  );
  const noaaBuoyPromise = createNoaaBuoyWind(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const [archivedData, shipReports, windfinderWinds, noaaBuoyWinds] =
    await Promise.all([
      archivedPromise,
      shipReportPromise,
      windfinderPromise,
      noaaBuoyPromise,
    ]);

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

module.exports = processRegionRequest;
