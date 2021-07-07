const puppeteer = require('puppeteer');
const KDBush = require('kdbush');

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

const createShipReport = async () => {
  const values = await getShipReports();
  let shipReportIndex = new KDBush(
    values,
    (v) => v.lon,
    (v) => v.lat,
  );
  let shipReportsFeatureCollection = weatherSourceToFeatureCollection(values);
  return {
    shipReportIndex,
    shipReportsFeatureCollection,
  };
};

module.exports = createShipReport;