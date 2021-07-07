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
  await axios({
    url: webhook,
    method: 'POST',
    data: {
      token: webhookToken,
      archivedData,
      shipReports,
      windfinderReports,
    },
  });
}

module.exports = processRegionRequest;
