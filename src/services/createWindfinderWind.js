const puppeteer = require('puppeteer');
const axios = require('axios');
const turf = require('@turf/turf');

const weatherSourceToFeatureCollection = require('../utils/weatherSourceToFeatureCollection');

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
  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox'],
    });
    const page = await browser.newPage();
    // Using default 30000ms timeout often results in timeout exceeded error
    // page.setDefaultNavigationTimeout(90000);
    // Update: Changed to waitUntil domcontentloaded, no need to wait their script to just get the token
    await page.goto(windfinderUrl, { waitUntil: 'domcontentloaded' });
    const token = await page.evaluate(() => {
      return API_TOKEN;
    });
    await browser.close();
    return token;
  } catch (error) {
    console.error('Failed to get token using puppeteer', error);
    return null;
  }
}

async function requestWindfinderReport(spotID, token) {
  const dataUrl = `https://api.windfinder.com/v2/spots/${spotID}/reports/?limit=-1&timespan=last24h&step=1m&customer=wfweb&version=1.0&token=${token}`;
  const reportData = await axios.get(dataUrl);
  const reports = [];
  if (Array.isArray(reportData.data) && reportData.data.length > 0) {
    reportData.data.forEach((datum) => {
      // "ws":8,"wd":90,"at":29.0,"ap":927,"cl":25,"dtl":"2021-07-05T13:00:00+07:00","dtl_s":"2021-07-05T12:59:30+07:00"
      // TODO: what are these two times?
      const time1 = new Date(datum.dtl); // This is the data shown on their graph
      const time2 = new Date(datum.dtl_s); // not sure about this one
      const windSpeedKTS = datum.ws;
      const windGustKTS = datum.wg; // This possibly null, when I tested a spot in Indonesia, there's no gust value
      const windDirectionDegrees = datum.wd;
      const atmosphericPressureMB = datum.ap;

      reports.push({
        windSpeedKTS,
        windGustKTS,
        windDirectionDegrees,
        atmosphericPressureMB,
        time1,
        time2,
      });
    });
  }
  return reports;
}

async function createWindfinderWind(
  spots,
  startTimeUnixMS,
  endTimeUnixMS,
  stopOnFirstReport = false,
) {
  const startTime = new Date(startTimeUnixMS);
  const endTime = new Date(endTimeUnixMS);
  const windfinderReports = [];

  if (spots.length > 0) {
    let token = null;
    let tryCount = 0;
    do {
      tryCount++;
      token = await getWindfinderToken(spots[0].url); // Use the first url to get token
    } while (token == null && tryCount < 3);

    if (token == null) {
      // Still failing after 3 trial
      // TODO: Should we increase try count threshold value?
      return weatherSourceToFeatureCollection([]);
    }

    for (let i = 0; i < spots.length; i++) {
      const { id: spotID, lon, lat } = spots[i];
      const reports = await requestWindfinderReport(spotID, token);
      if (reports.length > 0) {
        // Only get the timestamp we want
        const slicedReports = reports.filter((row) => {
          return startTime <= row.time1 && endTime >= row.time1;
        });
        if (slicedReports.length > 0) {
          windfinderReports.push({
            spotID,
            lon,
            lat,
            reports: slicedReports,
          });
          if (stopOnFirstReport) {
            break;
          }
        }
      }
    }
  }

  return weatherSourceToFeatureCollection(windfinderReports);
}

module.exports = createWindfinderWind;
