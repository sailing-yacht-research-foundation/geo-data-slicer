const turf = require('@turf/turf');

function makeGeoJsons(data) {
  const varTotimeToLevelToPoints = {};
  data.forEach((line) => {
    const { time, variable, level, lon, lat, value } = line;
    const pointHash = `${lon}${lat}`;

    let varGroup = '';
    switch (variable) {
      case 'UGRD':
      case 'VGRD':
        varGroup = 'uvgrd';
        break;
      case 'UOGRD':
      case 'VOGRD':
        varGroup = 'uvogrd';
        break;
      default:
        varGroup = variable;
        break;
    }

    if (varTotimeToLevelToPoints[varGroup] === undefined) {
      varTotimeToLevelToPoints[varGroup] = {};
    }

    if (varTotimeToLevelToPoints[varGroup][time] === undefined) {
      varTotimeToLevelToPoints[varGroup][time] = {};
    }

    if (varTotimeToLevelToPoints[varGroup][time][level] === undefined) {
      varTotimeToLevelToPoints[varGroup][time][level] = {};
    }

    if (
      varTotimeToLevelToPoints[varGroup][time][level][pointHash] === undefined
    ) {
      varTotimeToLevelToPoints[varGroup][time][level][pointHash] = {
        lat: parseFloat(lat),
        lon: parseFloat(lon),
      };
    }
    varTotimeToLevelToPoints[varGroup][time][level][pointHash][variable] =
      value;
  });

  const geoJsons = [];
  Object.keys(varTotimeToLevelToPoints).forEach((varGroup) => {
    Object.keys(varTotimeToLevelToPoints[varGroup]).forEach((time) => {
      Object.keys(varTotimeToLevelToPoints[varGroup][time]).forEach((level) => {
        const geoJsonPoints = [];
        Object.values(varTotimeToLevelToPoints[varGroup][time][level]).forEach(
          (p) => {
            try {
              const { lon, lat, ...otherProps } = p;
              const geoJsonPoint = turf.point([p.lon, p.lat], otherProps);
              geoJsonPoints.push(geoJsonPoint);
            } catch (err) {}
          },
        );

        const geoJson = turf.featureCollection(geoJsonPoints);
        geoJson.properties = {
          level: level.replace(/"/gm, ''),
          time: time.replace(/"/gm, ''),
        };
        geoJsons.push(geoJson);
      });
    });
  });

  return geoJsons;
}

module.exports = makeGeoJsons;
