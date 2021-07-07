const puppeteer = require('puppeteer');
const turf = require('@turf/turf');

const weatherSourceToFeatureCollection = require('../utils/weatherSourceToFeatureCollection');
const valuesToDictionary = require('../utils/valuesToDictionary');

// Puppeteer methods
async function getShipReports() {
  // const browser = await puppeteer.launch();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  // Maximum available time past 12 hours
  await page.goto('https://www.ndbc.noaa.gov/ship_obs.php?uom=E&time=12');
  const values = await page.evaluate(() => {
    const values = [];
    document.querySelectorAll('#contentarea > pre > span').forEach((s) => {
      values.push(s.textContent.split(/[ ,]+/));
    });
    return values;
  });
  await browser.close();
  const valuesDictionaries = [];
  var counter = 0;
  values.forEach((valuesArray) => {
    if (counter > 0) {
      valuesDictionaries.push(valuesToDictionary(valuesArray));
    }
    counter++;
  });
  /*
   {
    source: 'SHIP',
    hour: 6,
    lat: 34.7,
    lon: 124.8,
    twd_degrees: 300,
    tws_kts: 6,
    gust_kts: null,
    waveheight_ft: null
  }
  */
  return valuesDictionaries;
}

const createShipReport = async (roi, startTimeUnixMS, endTimeUnixMS) => {
  const currentTime = new Date().getTime();
  const twelveHoursAgo = currentTime - 1000 * 60 * 60 * 12;
  // We have no data available beyond these
  if (startTimeUnixMS > currentTime || endTimeUnixMS < twelveHoursAgo) {
    return null;
  }

  const fullShipReport = await getShipReports();

  const slicedShipReports = [];
  const currentHour = new Date().getUTCHours();
  const compareTime = new Date(currentTime);
  compareTime.setMinutes(0);
  compareTime.setSeconds(0);
  compareTime.setMilliseconds(0);

  fullShipReport.forEach((row) => {
    let diff = currentHour - row.hour;
    if (row.hour > currentHour) {
      diff += 24;
    }
    const dataTime = compareTime - 1000 * 60 * 60 * diff;
    if (dataTime >= startTimeUnixMS && dataTime <= endTimeUnixMS) {
      slicedShipReports.push({
        ...row,
        time: new Date(dataTime).toISOString(),
      });
    }
  });

  // let shipReportIndex = new KDBush(
  //   slicedShipReports,
  //   (v) => v.lon,
  //   (v) => v.lat,
  // );

  const shipReportsFeatureCollection =
    weatherSourceToFeatureCollection(slicedShipReports);
  const shipReports = turf.pointsWithinPolygon(
    shipReportsFeatureCollection,
    roi,
  );
  return shipReports;
};

module.exports = createShipReport;
