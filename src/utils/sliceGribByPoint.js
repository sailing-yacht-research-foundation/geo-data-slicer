const execSync = require('child_process').execSync;
const turf = require('@turf/turf');
const dayjs = require('dayjs');

const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const makeGeoJsons = require('./makeGeoJsons');

function sliceGribByPoint(point, filename) {
  // TODO: Does different model have different ways to slice? Need to check
  const [lon, lat] = point.geometry.coordinates;

  const data = execSync(
    `wgrib2 ${filename} -VT -var -lev -lon ${lon} ${lat}`,
  ).toString();
  execSync(`rm ${filename}`);
  const rows = data.split('\n');
  const finalData = [];
  rows.forEach((row) => {
    if (row !== '') {
      const datums = row.split(':');
      const time = dayjs(datums[2].split('=')[1], 'YYYYMMDDHHmmss');
      const variable = datums[3]; // VRGD UGRD etc
      const level = datums[4];
      const values = datums[5].split(',');
      let lon = values[0].split('=')[1];
      if (lon > 180) {
        lon = String(Number(lon) - 360);
      }
      const lat = values[1].split('=')[1];
      const value = values[2].split('=')[1];
      finalData.push({
        time: time.toISOString(),
        variable,
        level,
        lon,
        lat,
        value: Number(value),
      });
      //   console.log(
      //     time.format('YYYY-MM-DD HH:mm:ss'),
      //     variable,
      //     level,
      //     lon,
      //     lat,
      //     value,
      //   );
    }
  });

  const timeToLevelToPoints = {};
  finalData.forEach((line) => {
    const { time, variable, level, lon, lat, value } = line;
    const pointHash = `${lon}${lat}`;

    if (timeToLevelToPoints[time] === undefined) {
      timeToLevelToPoints[time] = {};
    }

    if (timeToLevelToPoints[time][level] === undefined) {
      timeToLevelToPoints[time][level] = {};
    }

    if (timeToLevelToPoints[time][level][pointHash] === undefined) {
      timeToLevelToPoints[time][level][pointHash] = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      };
    }
    timeToLevelToPoints[time][level][pointHash][variable] = value;
  });

  const geoJsons = [];
  Object.keys(timeToLevelToPoints).forEach((time) => {
    Object.keys(timeToLevelToPoints[time]).forEach((level) => {
      const geoJsonPoints = [];
      Object.values(timeToLevelToPoints[time][level]).forEach((p) => {
        try {
          const { lon, lat, ...otherProps } = p;
          const geoJsonPoint = turf.point([p.lon, p.lat], otherProps);
          geoJsonPoints.push(geoJsonPoint);
        } catch (err) {}
      });

      const geoJson = turf.featureCollection(geoJsonPoints);
      geoJson.properties = {
        level: level.replace(/"/gm, ''),
        time: time.replace(/"/gm, ''),
      };
      geoJsons.push(geoJson);
    });
  });
  return geoJsons;
}

module.exports = sliceGribByPoint;
