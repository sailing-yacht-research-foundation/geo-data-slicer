const axios = require('axios');

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
  const windfinderPromise = createWindfinderWind(
    roi,
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
