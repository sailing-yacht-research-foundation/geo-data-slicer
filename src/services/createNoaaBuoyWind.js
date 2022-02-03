const axios = require('axios');
const logger = require('../logger');

const weatherSourceToFeatureCollection = require('../utils/weatherSourceToFeatureCollection');

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
  // Based on recent testing, no recent data means it also doesn't have any data at all (404 pages), so keeping this the way it was
  const stationList = {};
  response.data.station.forEach((row) => {
    stationList[row.id] = row.data === 'y';
  });
  return stationList;
}

const createNoaaBuoyWind = async (
  buoys,
  startTimeUnixMS,
  endTimeUnixMS,
  stopOnFirstReport = false,
) => {
  const currentTime = new Date().getTime();
  const monthAgo = currentTime - 1000 * 60 * 60 * 24 * 30;
  const startTime = new Date(startTimeUnixMS);
  const endTime = new Date(endTimeUnixMS);

  if (startTimeUnixMS > currentTime || endTimeUnixMS < monthAgo) {
    // Available data varies, might have months back data, but it's unlikely
    logger.info(`Skipping noaabuoy scrape`);
    return weatherSourceToFeatureCollection([]);
  }

  const availableStations = await getAvailableStation();
  const buoyWinds = [];

  for (let i = 0; i < buoys.length; i++) {
    const { url: buoyUrl, lon, lat } = buoys[i];
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
              gustMS: gustMS === 'MM' ? undefined : Number(gustMS),
              pressureHPA:
                pressureHPA === 'MM' ? undefined : Number(pressureHPA),
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
      if (stopOnFirstReport) {
        break;
      }
    } catch (error) {
      logger.error(`Error scraping NOAA Buoy Wind: ${error.message}`);
      logger.error(`Current Station: ${station}`);
    }
  }

  return weatherSourceToFeatureCollection(buoyWinds);
};

module.exports = createNoaaBuoyWind;
