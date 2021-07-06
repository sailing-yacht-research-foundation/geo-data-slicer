const express = require('express');
const turf = require('@turf/turf');

const processRegionRequest = require('../services/processRegionRequest');
const getArchivedData = require('../services/getArchivedData');
const createWindfinderWind = require('../services/createWindfinderWind');

var router = express.Router();

router.get('/test', async function (request, response) {
  // ReadyAbout meta data table: f401aa73-c0be-4acd-835c-60952484fe49
  // {"type":"Polygon","coordinates":[[[5.720305,53.008259],[5.772853,53.008259],[5.772853,53.034974],[5.720305,53.034974],[5.720305,53.008259]]]}
  let roi = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [5.720305, 53.008259],
          [5.772853, 53.008259],
          [5.772853, 53.034974],
          [5.720305, 53.034974],
          [5.720305, 53.008259],
        ],
      ],
    },
  };

  // let bboxFromDB = {
  //   type: 'Polygon',
  //   coordinates: [
  //     [
  //       [4.731845, 52.026334],
  //       [4.737645, 52.026334],
  //       [4.737645, 52.03329],
  //       [4.731845, 52.03329],
  //       [4.731845, 52.026334],
  //     ],
  //   ],
  // };
  // let bbox = turf.bbox(bboxFromDB);
  // const leftLon = bbox[0];
  // const bottomLat = bbox[1];
  // const rightLon = bbox[2];
  // const topLat = bbox[3];
  // console.log(bbox);
  // [ -17.0068359375, 47.35371061951363, 2.5927734375, 58.367156332478885 ]
  // https://api.windfinder.com/v2/maps/spots/boundingbox/?ne=58.367156332478885,2.5927734375&sw=47.35371061951363,-17.0068359375&z=7&customer=wfweb&version=1.0&token=43200b113a4566095f7be73a3c6c3f42
  // https://api.windfinder.com/v2/maps/spots/boundingbox/?ne=${bbox[3]},${bbox[2]}&sw=${bbox[1]},${bbox[0]}&z=9&customer=wfweb&version=1.0&token=43200b113a4566095f7be73a3c6c3f42

  // let poly = turf.bboxPolygon([
  //   -5.839233398437501, 53.33415333620371, -0.5630493164062501, 55.637298574163,
  // ]);
  // let area = turf.area(poly);
  // console.log(area);
  // https://api.windfinder.com/v2/maps/spots/boundingbox/?ne=55.637298574163,-0.5630493164062501&sw=53.33415333620371,-5.839233398437501&z=9&customer=wfweb&version=1.0&token=dfd6008a22504910678655e303e27780
  // console.log(
  //   'url:',
  //   `https://api.windfinder.com/v2/maps/spots/boundingbox/?ne=${bbox[3]},${bbox[2]}&sw=${bbox[1]},${bbox[0]}&z=9&customer=wfweb&version=1.0&token=43200b113a4566095f7be73a3c6c3f42`,
  // );
  const reports = await createWindfinderWind(roi);
  response.json({
    message: 'This is a test url',
    reports,
  });
});

router.post('/', async function (request, response) {
  const roi = request.body.roi;
  const startTimeUnixMS = request.body.startTimeUnixMS;
  const endTimeUnixMS = request.body.endTimeUnixMS;
  // Where should we send the data?
  const webhook = request.body.webhook;
  const webhookToken = request.body.webhookToken;

  // How often should we check the real time sources for new data?
  const updateFrequencyMinutes = request.body.updateFrequencyMinutes;

  processRegionRequest(
    roi,
    startTimeUnixMS,
    endTimeUnixMS,
    webhook,
    webhookToken,
    updateFrequencyMinutes,
  );
  response.send('ok');
});

router.get('/temp', async function (request, response) {
  var roi = turf.polygon([
    [
      [-16.5234375, 52.93539665862318],
      [-9.140625, 47.35371061951363],
      [2.5927734375, 52.62972886718355],
      [-3.33984375, 58.367156332478885],
      [-17.0068359375, 56.218923189166624],
      [-16.5234375, 52.93539665862318],
    ],
  ]);
  const startTime = new Date('2021-06-29T17:00:00+0000').getTime();
  const endTime = new Date('2021-06-29T18:00:00+0000').getTime();
  const result = await getArchivedData(roi, startTime, endTime);
  response.json({ result });
  //   res.send("ok");
});

module.exports = router;
