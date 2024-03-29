const turf = require('@turf/turf');
const fs = require('fs');
const { promisify } = require('util');
const path = require('path');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const { VALID_TIMEFRAME } = require('../configs/sourceModel.config');
const mapERA5Variables = require('./mapERA5Variables');

async function csvToGeoJson({
  id,
  model,
  searchStartTime,
  searchEndTime,
  csvFilePath,
  folder,
  sliceJson = true,
}) {
  const csvData = await readFile(csvFilePath, 'utf-8');
  const varTotimeToLevelToPoints = {};
  const runtimes = new Set();
  const variablesToLevel = new Map();

  csvData.split('\n').forEach((line) => {
    const lineComponents = line.split(',');
    if (lineComponents.length == 7) {
      let [_refTime, time, variable, level, lon, lat, value] = lineComponents;
      level = level.replace(/"/gm, '');
      time = time.replace(/"/gm, '');

      const endTimeModifier = VALID_TIMEFRAME[model] || 3600000; // Default to 1 hour validity
      const jsonStartTime = `${time}+00`;
      const jsonStartTimeUnix = Date.parse(jsonStartTime);
      const jsonEndTimeUnix = jsonStartTimeUnix + endTimeModifier;
      if (
        !(
          jsonStartTimeUnix > searchEndTime || jsonEndTimeUnix < searchStartTime
        )
      ) {
        const pointHash = `${lon}${lat}`;
        variable = variable.replace(/"/gm, '');
        runtimes.add(`${time}+00`);
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
          if (existingVTL.indexOf(level) === -1) {
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
        varTotimeToLevelToPoints[varGroup][time][level][pointHash][
          mapERA5Variables(variable)
        ] = parseFloat(value);
      }
    }
  });

  const geoJsons = [];
  if (sliceJson) {
    for (const varGroup of Object.keys(varTotimeToLevelToPoints)) {
      for (const time of Object.keys(varTotimeToLevelToPoints[varGroup])) {
        for (const level of Object.keys(
          varTotimeToLevelToPoints[varGroup][time],
        )) {
          // Write to file instead
          const timeInMs = new Date(time).getTime();
          const filePath = `${folder}/${id}_${varGroup}_${timeInMs}_${level.replaceAll(
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
              variables.push(mapERA5Variables(varGroup));
              break;
          }
          await writeFile(
            filePath,
            JSON.stringify({
              ...turf.featureCollection(
                Object.values(varTotimeToLevelToPoints[varGroup][time][level])
                  .map((p) => {
                    try {
                      const { lon, lat, ...otherProps } = p;
                      return turf.point([p.lon, p.lat], otherProps);
                    } catch (err) {
                      console.log('Error turf point', err);
                    }
                    return null;
                  })
                  .filter((row) => row !== null),
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
  }

  return {
    runtimes: Array.from(runtimes),
    variablesToLevel,
    geoJsons,
  };
}

module.exports = csvToGeoJson;
