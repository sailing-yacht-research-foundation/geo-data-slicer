const fs = require('fs');
const path = require('path');
const KDBush = require('kdbush');

const pointSourcesToScrape = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../data/weather_sources.json'),
    'utf-8',
  ),
);

const windfinderPoints = pointSourcesToScrape.WINDFINDER;
const noaaBuoyPoints = pointSourcesToScrape.NOAA;

const windfinderIndex = new KDBush(
  pointSourcesToScrape.WINDFINDER,
  (v) => v.lon,
  (v) => v.lat,
);

const noaaBuoyIndex = new KDBush(
  pointSourcesToScrape.NOAA,
  (v) => v.lon,
  (v) => v.lat,
);

module.exports = {
  windfinderIndex,
  noaaBuoyIndex,
  windfinderPoints,
  noaaBuoyPoints,
};
