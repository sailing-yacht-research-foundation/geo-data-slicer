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
  const archivedData = await getArchivedData(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const shipReports = await createShipReport(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const windfinderReports = await createWindfinderWind(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  const noaaBuoyWinds = await createNoaaBuoyWind(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );

  await axios({
    url: webhook,
    method: 'POST',
    data: {
      token: webhookToken,
      archivedData,
      shipReports,
      windfinderReports,
      noaaBuoyWinds,
    },
  });
}

module.exports = processRegionRequest;
