const express = require("express");
const turf = require("@turf/turf");

const processRegionRequest = require("../services/processRegionRequest");
var router = express.Router();

router.get("/test", async function (req, res) {
  res.json({
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
  res.send("ok");
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
  processRegionRequest(roi, 0, 0, "", "", 1);
  res.send("ok");
});

module.exports = router;
