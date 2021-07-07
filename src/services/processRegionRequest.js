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

  const currentTime = new Date().getTime();
  const twelveHoursAgo = currentTime - 1000 * 60 * 60 * 12;
  let shipFeatures = [];
  // We have no data available beyond these
  if (!(startTimeUnixMS > currentTime || endTimeUnixMS < twelveHoursAgo)) {
    const { shipReportsFeatureCollection } = await createShipReport();
    const containedShipReports = turf.pointsWithinPolygon(
      shipReportsFeatureCollection,
      roi,
    );
    const currentHour = new Date().getUTCHours();
    const compareTime = new Date(currentTime);
    compareTime.setMinutes(0);
    compareTime.setSeconds(0);
    compareTime.setMilliseconds(0);
    containedShipReports.features.forEach((row) => {
      let diff = currentHour - row.properties.hour;
      if (row.properties.hour > currentHour) {
        diff += 24;
      }
      const dataTime = compareTime - 1000 * 60 * 60 * diff;
      if (dataTime >= startTimeUnixMS && dataTime <= endTimeUnixMS) {
        shipFeatures.push({
          ...row,
          properties: {
            ...row.properties,
            time: new Date(dataTime).toISOString(),
          },
        });
      }
    });
  }

  const windfinderReports = await createWindfinderWind(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
  );
  await axios({
    url: webhook,
    method: 'POST',
    data: {
      archivedData,
      shipReports: {
        type: 'FeatureCollection',
        features: shipFeatures,
      },
      windfinderReports,
    },
  });
}

module.exports = processRegionRequest;
