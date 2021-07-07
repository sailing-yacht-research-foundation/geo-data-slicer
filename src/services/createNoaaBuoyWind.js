const puppeteer = require('puppeteer');
const axios = require('axios');
const turf = require('@turf/turf');

const weatherSourceToFeatureCollection = require('../utils/weatherSourceToFeatureCollection');
const { noaaBuoyIndex, noaaBuoyPoints } = require('./createSourceIndex');

async function getAvailableStation() {
  const response = await axios.get(
    'https://www.ndbc.noaa.gov/ndbcmapstations.json',
  );
  /*
    {"id":"32489","lat":2.998,"lon":-79.101,"elev":null,"name":"Colombia   121NM SW of Buenaventura, Colombia","owner":24,"program":7,"status":"E","data":"n","type":"dart"} = Merah
    Stations with no data in last 8 hours (24 hours for tsunami stations)

    {"id":"32069","lat":0.255,"lon":-81.211,"elev":null,"name":"ECUADOR INOCAR - 71 NM West of Pedernales, Ecuador   ","owner":41,"program":7,"status":"E","data":"y","type":"dart"} = Kuning
    Stations with recent data
  */
  const stationList = {};
  response.data.station.forEach((row) => {
    stationList[row.id] = row.data === 'y';
  });
  return stationList;
}

const createNoaaBuoyWind = async (roi, startTimeUnixMS, endTimeUnixMS) => {
  const startTime = new Date(startTimeUnixMS);
  const endTime = new Date(endTimeUnixMS);
  let bbox = turf.bbox(roi);

  const buoyList = noaaBuoyIndex
    .range(bbox[0], bbox[1], bbox[2], bbox[3])
    .map((id) => noaaBuoyPoints[id]);

  const availableStations = await getAvailableStation();
  const buoyWinds = [];
  for (let i = 0; i < buoyList.length; i++) {
    const { url: buoyUrl, lon, lat } = buoyList[i];
    const station = buoyUrl.split('station=')[1];
    if (!availableStations[station]) {
      // Will be 404 anyway
      continue;
    }
    let response = null;
    try {
      response = await axios.get(
        `https://www.ndbc.noaa.gov/data/realtime2/${station}.txt`,
      );
      const lines = response.data.split('\n');
      const reports = [];
      for (let count = 0; count <= lines.length; count++) {
        // First two lines are column names and units.
        if (count > 1) {
          if (lines[count] === undefined) {
            continue;
          }
          const items = lines[count].split(/\s+/);
          // https://www.ndbc.noaa.gov/measdes.shtml#stdmet
          const year = items[0];
          const month = items[1];
          const day = items[2];
          const hour = items[3];
          const minute = items[4];
          const recordTime = new Date(
            `${year}-${month}-${day}T${hour}:${minute}:00.000Z`,
          );
          if (recordTime >= startTime && recordTime <= endTime) {
            //   const windDirectionTrue = items[5];
            //   const windSpeedMS = items[6];
            const gustMS = items[7];
            //   const waveHeightM = items[8];
            //   const waveDirection = items[11];
            const pressureHPA = items[12];
            reports.push({
              recordTime,
              // windDirectionTrue,
              // windSpeedMS,
              gustMS,
              pressureHPA,
            });
          }
        }
      }
      buoyWinds.push({
        lon,
        lat,
        buoyUrl,
        reports,
      });
    } catch (error) {
      console.log('current station:', station, response);
      console.error(error.message);
    }
  }

  return weatherSourceToFeatureCollection(buoyWinds);
};

module.exports = createNoaaBuoyWind;
