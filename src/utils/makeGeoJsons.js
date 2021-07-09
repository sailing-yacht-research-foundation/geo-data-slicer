const turf = require('@turf/turf');

function makeGeoJsons(data) {
  const timeToLevelToPoints = {};
  data.forEach((line) => {
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

module.exports = makeGeoJsons;
