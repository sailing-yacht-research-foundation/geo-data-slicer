const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const KDBush = require('kdbush');

const weatherSourceToFeatureCollection = require('../utils/weatherSourceToFeatureCollection');
const valuesToDictionary = require('../utils/valuesToDictionary');

const pointSourcesToScrape = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../data/dynamic_weather_sources.json'),
    'utf-8',
  ),
);

const sailFlowSpotIndex = new KDBush(
  pointSourcesToScrape.SAILFLOW,
  (v) => v.lon,
  (v) => v.lat,
);
const noaaBuoyIndex = new KDBush(
  pointSourcesToScrape.NOAA,
  (v) => v.lon,
  (v) => v.lat,
);
const windfinderIndex = new KDBush(
  pointSourcesToScrape.WINDFINDER,
  (v) => v.lon,
  (v) => v.lat,
);

const sailFlowSpotFeatureCollection = weatherSourceToFeatureCollection(
  pointSourcesToScrape.SAILFLOW,
);
const noaaBuoyFeatureCollection = weatherSourceToFeatureCollection(
  pointSourcesToScrape.NOAA,
);
const windfinderFeatureCollection = weatherSourceToFeatureCollection(
  pointSourcesToScrape.WINDFINDER,
);

// Puppeteer methods
async function getShipReports() {
  // const browser = await puppeteer.launch();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.goto('https://www.ndbc.noaa.gov/ship_obs.php?uom=E&time=2');
  const values = await page.evaluate(() => {
    const values = [];
    document.querySelectorAll('#contentarea > pre > span').forEach((s) => {
      values.push(s.textContent.split(/[ ,]+/));
    });
    return values;
  });

  const valuesDictionaries = [];
  var counter = 0;
  values.forEach((valuesArray) => {
    if (counter > 0) {
      valuesDictionaries.push(valuesToDictionary(valuesArray));
    }
    counter++;
  });
  await browser.close();
  return valuesDictionaries;
}

async function getWindfinderWind(windfinderUrl, id) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(windfinderUrl);
  const token = await page.evaluate(() => {
    return API_TOKEN;
  });
  await browser.close();

  const dataUrl =
    'https://api.windfinder.com/v2/spots/' +
    id +
    '/reports/?limit=-1&timespan=last24h&step=1m&customer=wfweb&version=1.0&token=' +
    token;

  const reportData = await axios.get(dataUrl);
  const reports = [];
  reportData.data.forEach((datum) => {
    const windSpeedKTS = datum.ws;
    const windGustKTS = datum.wg;
    const windDirectionDegrees = datum.wd;
    const atmosphericPressureMB = datum.ap;
    // TODO: what are these two times?
    const time1 = datum.dtl;
    const time2 = datum.dtl_s;

    reports.push({
      windSpeedKTS,
      windGustKTS,
      windDirectionDegrees,
      atmosphericPressureMB,
      time1,
      time2,
    });
  });

  return reports;
}

async function getSailflowWind(sailflowUrl) {
  // TODO: this is blocked for many non-pro stations.
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(sailflowUrl);
  const token = await page.evaluate(() => {
    return token;
  });
  await browser.close();
  const currentTimestamp = new Date().getTime();
  const spotId = sailflowUrl.split('spot/')[1];
  const url =
    'https://api.weatherflow.com/wxengine/rest/graph/getGraph?callback=jQuery172021690568611973737_1624546247136&units_wind=mph&units_temp=f&units_distance=mi&fields=wind&format=json&null_ob_min_from_now=60&show_virtual_obs=true&spot_id=1790&time_start_offset_hours=-4&time_end_offset_hours=0&type=dataonly&model_ids=-101&wf_token=e98555ab5750420706ecc152a031d53f&_=1624546247487';
  //https://api.weatherflow.com/wxengine/rest/spot/getObservationSummary?callback=jQuery172021690568611973737_1624546247136&units_wind=mph&units_temp=f&units_distance=mi&fields=wind&format=json&null_ob_min_from_now=60&show_virtual_obs=true&spot_id=1790&time_start_offset_hours=-4&time_end_offset_hours=0&type=dataonly&model_ids=-101&wf_token=e98555ab5750420706ecc152a031d53f&_=1624546247487
  //https://api.weatherflow.com/wxengine/rest/stat/getSpotStats?callback=jQuery172021690568611973737_1624546247136&units_wind=mph&units_temp=f&units_distance=mi&fields=wind&format=json&null_ob_min_from_now=60&show_virtual_obs=true&spot_id=1790&time_start_offset_hours=-4&time_end_offset_hours=0&type=dataonly&model_ids=-101&wf_token=e98555ab5750420706ecc152a031d53f&_=1624546247487

  const data = await axios.get(url);
  console.log(data.data);
}

async function getNoaaBuoyWind(buoyUrl) {
  //https://www.ndbc.noaa.gov/data/realtime2/46232.txt
  const station = buoyUrl.split('station=')[1];
  const data = await axios.get(
    'https://www.ndbc.noaa.gov/data/realtime2/' + station + '.txt',
  );
  const lines = data.data.split('\n');
  const reports = [];
  for (var count = 0; count <= 11; count++) {
    // First two lines are column names and units.
    if (count > 1) {
      const items = lines[count].split(/\s+/);
      // https://www.ndbc.noaa.gov/measdes.shtml#stdmet
      const year = items[0];
      const month = items[1];
      const day = items[2];
      const hour = items[3];
      const minute = items[4];
      const windDirectionTrue = items[5];
      const windSpeedMS = items[6];
      const gustMS = items[7];
      const waveHeightM = items[8];
      const waveDirection = items[11];
      const pressureHPA = items[12];
      reports.push({
        year,
        month,
        day,
        hour,
        minute,
        windDirectionTrue,
        windSpeedMS,
        gustMS,
        pressureHPA,
      });
    }
  }
  // TODO: filter out reports without windspeed and direction.
  return reports;
}

var shipReportIndex = null;
var shipReportsFeatureCollection = null;
const createShipReport = async () => {
  if (shipReportIndex && shipReportsFeatureCollection) {
    return {
      shipReportIndex,
      shipReportsFeatureCollection,
    };
  }
  const values = await getShipReports();
  shipReportIndex = new KDBush(
    values,
    (v) => v.lon,
    (v) => v.lat,
  );
  shipReportsFeatureCollection = weatherSourceToFeatureCollection(values);
  return {
    shipReportIndex,
    shipReportsFeatureCollection,
  };
};

module.exports = {
  sailFlowSpotIndex,
  sailFlowSpotFeatureCollection,
  noaaBuoyIndex,
  noaaBuoyFeatureCollection,
  windfinderIndex,
  windfinderFeatureCollection,
  createShipReport,
};
