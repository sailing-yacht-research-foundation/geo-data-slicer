const express = require("express");
const turf = require("@turf/turf");

const processRegionRequest = require("../services/processRegionRequest");
const getArchivedData = require("../services/getArchivedData");
const sliceGribByRegion = require("../utils/sliceGribByRegion");

var router = express.Router();

router.get("/test", async function (request, response) {
  response.json({
    message: "This is a test url",
  });
});

router.post("/", async function (request, response) {
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
    updateFrequencyMinutes
  );
  response.send("ok");
});

router.get("/temp", async function (request, response) {
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
  const startTime = new Date("2021-06-29T17:00:00+0000").getTime();
  const endTime = new Date("2021-06-29T18:00:00+0000").getTime();
  const result = await getArchivedData(roi, startTime, endTime);
  response.json({ result });
  //   res.send("ok");
});

module.exports = router;
