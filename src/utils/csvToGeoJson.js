const turf = require('@turf/turf');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');

const writeFile = promisify(fs.writeFile);

const INCLUDED_LEVELS = {
  ARPEGE_WORLD: [
    'mean sea level',
    '10 m above ground',
    // '2 m above ground', // Contains TMP & RH for 2 m above ground, ignoring
    // 'atmos col',
    'surface',
  ],
  // GFS: ['10 m above ground', '40 m above ground'],
  RTOFS_GLOBAL: ['0 m below sea level'],
  // Regionals
  AROME_FRANCE: [
    // 'mean sea level',
    '10 m above ground',
    // '2 m above ground',
    // 'atmos col',
    'surface',
  ],
  AROME_FRANCE_HD: [
    '10 m above ground',
    // '2 m above ground'
  ],
  ARPEGE_EUROPE: [
    // 'mean sea level',
    '10 m above ground',
    // '2 m above ground',
    // 'atmos col',
    'surface',
  ],
  RTOFS_FORECAST_WESTERN_CONUS: ['0 m below sea level'],
  RTOFS_FORECAST_WESTERN_ATLANTIC: ['0 m below sea level'],
  HRRR_SUB_HOURLY: ['10 m above ground', 'surface'],
};

async function csvToGeoJson(id, model, csvData) {
  const operatingPath = path.resolve(__dirname, `../../operating_folder`);
  const varTotimeToLevelToPoints = {};
  const runtimes = new Set();
  const variables = new Set();
  const variablesToLevel = new Map();

  csvData.split('\n').forEach((line) => {
    const lineComponents = line.split(',');
    if (lineComponents.length == 7) {
      let [_refTime, time, variable, level, lon, lat, value] = lineComponents;
      level = level.replace(/"/gm, '');
      time = time.replace(/"/gm, '');
      if (
        INCLUDED_LEVELS[model] &&
        INCLUDED_LEVELS[model].indexOf(level) === -1
      ) {
        // Skip
      } else {
        const pointHash = `${lon}${lat}`;
        variable = variable.replace(/"/gm, '');
        runtimes.add(`${time}+00`);
        variables.add(variable);
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
          case 'UGUST':
          case 'VGUST':
            varGroup = 'uvgust';
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
          const existingVTL = variablesToLevel.get(varGroup) || [];
          if (
            existingVTL.indexOf(level) === -1 &&
            ((INCLUDED_LEVELS[model] &&
              INCLUDED_LEVELS[model].indexOf(level) !== -1) ||
              !INCLUDED_LEVELS[model])
          ) {
            variablesToLevel.set(varGroup, [...existingVTL, level]);
          }
        }

        if (
          varTotimeToLevelToPoints[varGroup][time][level][pointHash] ===
          undefined
        ) {
          varTotimeToLevelToPoints[varGroup][time][level][pointHash] = {
            lat: parseFloat(lat),
            lon: parseFloat(lon),
          };
        }
        varTotimeToLevelToPoints[varGroup][time][level][pointHash][variable] =
          parseFloat(value);
      }
    }
  });

  const geoJsons = [];
  for (const varGroup of Object.keys(varTotimeToLevelToPoints)) {
    for (const time of Object.keys(varTotimeToLevelToPoints[varGroup])) {
      for (const level of Object.keys(
        varTotimeToLevelToPoints[varGroup][time],
      )) {
        // Write to file instead
        const timeInMs = new Date(time).getTime();
        const filePath = `${operatingPath}/${id}_${varGroup}_${timeInMs}_${level.replaceAll(
          ' ',
          '_',
        )}.geojson`;
        const variables = [];
        switch (varGroup) {
          case 'uvgrd':
            variables.push('UGRD');
            variables.push('VGRD');
            break;
          case 'uvogrd':
            variables.push('UOGRD');
            variables.push('VOGRD');
          case 'uvgust':
            variables.push('UGUST');
            variables.push('VGUST');
            break;
          default:
            variables.push(varGroup);
            break;
        }
        await writeFile(
          filePath,
          JSON.stringify({
            ...turf.featureCollection(
              Object.values(
                varTotimeToLevelToPoints[varGroup][time][level],
              ).map((p) => {
                try {
                  const { lon, lat, ...otherProps } = p;
                  return turf.point([p.lon, p.lat], otherProps);
                } catch (err) {}
              }),
            ),
            properties: {
              level: level.replace(/"/gm, ''),
              time: time.replace(/"/gm, ''),
            },
          }),
        );
        geoJsons.push({
          varGroup,
          time,
          level,
          filePath,
          variables,
        });
      }
    }
  }
  console.log('geoJsons length', geoJsons.length);
  return {
    runtimes,
    variables,
    variablesToLevel,
    geoJsons,
  };
}

module.exports = csvToGeoJson;
