const turf = require("@turf/turf");
const KDBush = require("kdbush");

function makeGeoJsons(csvData) {
  const lines = csvData.split("\n");
  const timeToLevelToPoints = {};
  const geoJsons = [];
  const indices = {};
  lines.forEach((line) => {
    const lineComponents = line.split(",");
    if (lineComponents.length == 7) {
      const time1 = lineComponents[0];
      const time2 = lineComponents[1];

      const variable = lineComponents[2].replace(/"/gm, "");
      const level = lineComponents[3];
      const lonString = lineComponents[4];
      const latString = lineComponents[5];
      const pointHash = lonString + latString;

      const lon = parseFloat(lineComponents[4]);
      const lat = parseFloat(lineComponents[5]);
      const value = parseFloat(lineComponents[6]);

      if (timeToLevelToPoints[time1] === undefined) {
        timeToLevelToPoints[time1] = {};
        indices[time1] = {};
      }

      if (timeToLevelToPoints[time1][level] === undefined) {
        timeToLevelToPoints[time1][level] = {};
      }

      if (timeToLevelToPoints[time1][level][pointHash] === undefined) {
        timeToLevelToPoints[time1][level][pointHash] = { lat: lat, lon: lon };
      }
      timeToLevelToPoints[time1][level][pointHash][variable] = value;
    }
  });

  Object.keys(timeToLevelToPoints).forEach((time) => {
    Object.keys(timeToLevelToPoints[time]).forEach((level) => {
      const geoJsonPoints = [];
      const points = [];
      Object.values(timeToLevelToPoints[time][level]).forEach((p) => {
        try {
          const { lon, lat, ...otherProps } = p;
          const geoJsonPoint = turf.point([p.lon, p.lat], otherProps);
          geoJsonPoints.push(geoJsonPoint);
          points.push(p);
        } catch (err) {}
      });

      const index = new KDBush(
        points,
        (v) => v.lon,
        (v) => v.lat
      );
      indices[time][level] = index;
      const geoJson = turf.featureCollection(geoJsonPoints);
      geoJson.properties = {
        level: level.replace(/"/gm, ""),
        time: time.replace(/"/gm, ""),
      };
      geoJsons.push(geoJson);
    });
  });
  return { geoJsons: geoJsons, indices: indices };
}

module.exports = makeGeoJsons;
