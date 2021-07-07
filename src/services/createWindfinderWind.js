const puppeteer = require('puppeteer');
const axios = require('axios');
const turf = require('@turf/turf');

const { windfinderIndex, windfinderPoints } = require('./createSourceIndex');
async function _MANUAL_getWindfinderToken() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  // Using default 30000ms timeout often results in timeout exceeded error
  page.setDefaultNavigationTimeout(90000);
  await page.goto('https://windfinder.com');
  const token = await page.evaluate(() => {
    return API_TOKEN;
  });
  await browser.close();
  return token;
}

async function _MANUAL_getWindfinderWind(roi) {
  const token = await getWindfinderToken();
  const bbox = turf.bbox(roi);
  const leftLon = bbox[0];
  const bottomLat = bbox[1];
  const rightLon = bbox[2];
  const topLat = bbox[3];

  const spotsUrl = `https://api.windfinder.com/v2/maps/spots/boundingbox/?ne=${topLat},${rightLon}&sw=${bottomLat},${leftLon}&z=9&customer=wfweb&version=1.0&token=${token}`;
  const spotsResponse = await axios.get(spotsUrl);
  const { data: spotsData } = spotsResponse;
  const windfinderReports = [];
  if (Array.isArray(spotsData)) {
    for (let i = 0; i < spotsData.length; i++) {
      const { id: spotID, tp, lat, lon, n: stationName } = spotsData[i];
      //check if the tp is w (weather station)
      if (tp === 'w') {
        const pinPoint = turf.point([lon, lat]);
        const isWithinRoi = turf.booleanWithin(pinPoint, roi);
        if (isWithinRoi) {
          // Do get the report from this spot
          const dataUrl = `https://api.windfinder.com/v2/spots/${spotID}/reports/?limit=-1&timespan=last24h&step=1m&customer=wfweb&version=1.0&token=${token}`;
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

            // "ws":8,"wd":90,"at":29.0,"ap":927,"cl":25,"dtl":"2021-07-05T13:00:00+07:00","dtl_s":"2021-07-05T12:59:30+07:00"

            reports.push({
              windSpeedKTS,
              windGustKTS,
              windDirectionDegrees,
              atmosphericPressureMB,
              time1,
              time2,
            });
          });
          windfinderReports.push({
            spotID,
            stationName,
            lon,
            lat,
            reports,
          });
        }
      }
    }
  }
  // {"id":"gb1069","n":"Shanes Hill","lat":54.82,"lon":-5.925,"kw":"shanes_hill","tp":"f","has":"1001010"}
  //https://api.windfinder.com/v2/spots/id209/reports/?limit=-1&timespan=2021-07-05T00%3A00%3A00%2B07%3A00%2FPT23H59M59S&step=1m&customer=wfweb&version=1.0&token=43200b113a4566095f7be73a3c6c3f42
  //https://api.windfinder.com/v2/spots/id209/reports/?limit=-1&timespan=last24h&step=1m&customer=wfweb&version=1.0&token=dfd6008a22504910678655e303e27780

  return windfinderReports;
}

async function getWindfinderToken(windfinderUrl) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  // Using default 30000ms timeout often results in timeout exceeded error
  page.setDefaultNavigationTimeout(90000);
  await page.goto(windfinderUrl);
  const token = await page.evaluate(() => {
    return API_TOKEN;
  });
  await browser.close();
  return token;
}

const createWindfinderWind = async (roi) => {
  //   const data = await getWindfinderWind(roi);
  let bbox = turf.bbox(roi);

  const idList = windfinderIndex
    .range(bbox[0], bbox[1], bbox[2], bbox[3])
    .map((id) => windfinderPoints[id]);

  const windfinderReports = [];
  if (idList.length > 0) {
    // scrape!
    const token = await getWindfinderToken(idList[0].url); // Use the first url to get token
    for (let i = 0; i < idList.length; i++) {
      const { id: spotID, lon, lat } = idList[i];
      const dataUrl = `https://api.windfinder.com/v2/spots/${spotID}/reports/?limit=-1&timespan=last24h&step=1m&customer=wfweb&version=1.0&token=${token}`;
      const reportData = await axios.get(dataUrl);
      if (Array.isArray(reportData.data) && reportData.data.length > 0) {
        const reports = [];
        reportData.data.forEach((datum) => {
          const windSpeedKTS = datum.ws;
          const windGustKTS = datum.wg;
          const windDirectionDegrees = datum.wd;
          const atmosphericPressureMB = datum.ap;
          // TODO: what are these two times?
          const time1 = datum.dtl;
          const time2 = datum.dtl_s;

          // "ws":8,"wd":90,"at":29.0,"ap":927,"cl":25,"dtl":"2021-07-05T13:00:00+07:00","dtl_s":"2021-07-05T12:59:30+07:00"

          reports.push({
            windSpeedKTS,
            windGustKTS,
            windDirectionDegrees,
            atmosphericPressureMB,
            time1,
            time2,
          });
        });
        windfinderReports.push({
          spotID,
          lon,
          lat,
          reports,
        });
      }
    }
  }

  return windfinderReports;
};

module.exports = createWindfinderWind;
