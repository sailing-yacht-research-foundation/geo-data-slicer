const fs = require('fs');
const execSync = require('child_process').execSync;

const parseCsvData = require('./parseCsvData');
const makeGeoJsons = require('./makeGeoJsons');

const INCLUDED_LEVELS = {
  ARPEGE_WORLD: [
    // 'mean sea level',
    '10 m above ground',
    // '2 m above ground', // Contains TMP & RH for 2 m above ground, ignoring
    // 'atmos col',
    'surface',
  ],
  GFS: ['10 m above ground'],
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

function sliceGribByRegion(bbox, filename, options) {
  let { fileID, folder, model } = options;
  // Need to round up and down values, so that bounding box doesn't become too small
  // https://www.cpc.ncep.noaa.gov/products/wesley/wgrib2/small_grib.html
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);

  execSync(
    `wgrib2 ${filename} -small_grib ${leftLon}:${rightLon} ${bottomLat}:${topLat} ${folder}/small_${fileID}.grib2`,
  );
  execSync(
    `wgrib2 ${folder}/small_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
  );
  fs.unlinkSync(filename);
  const csvData = fs.readFileSync(`${folder}/${fileID}.csv`, 'utf-8');
  fs.unlinkSync(`${folder}/${fileID}.csv`);
  const parsedData = parseCsvData(csvData);
  const geoJsons = makeGeoJsons(parsedData);

  const levels = new Set();
  const runtimes = new Set();
  const variables = new Set();
  const variablesToLevel = new Map();

  const finalResult = geoJsons.filter((geoJson) => {
    levels.add(geoJson.properties.level);
    runtimes.add(`${geoJson.properties.time}+00`);
    for (const variable in geoJson.features[0].properties) {
      variables.add(variable);
      const existingVTL = variablesToLevel.get(variable) || [];
      if (
        (INCLUDED_LEVELS[model] &&
          INCLUDED_LEVELS[model].indexOf(geoJson.properties.level) !== -1) ||
        !INCLUDED_LEVELS[model]
      ) {
        variablesToLevel.set(variable, [
          ...existingVTL,
          geoJson.properties.level,
        ]);
      }
    }
    if (INCLUDED_LEVELS[model]) {
      return INCLUDED_LEVELS[model].indexOf(geoJson.properties.level) !== -1;
    }
    return false;
  });

  let slicedGribs = [];
  variables.forEach((variable) => {
    let varLevels = INCLUDED_LEVELS[model]
      ? INCLUDED_LEVELS[model].join('|')
      : Array.from(levels).join('|');
    switch (variable) {
      case 'UGRD':
        execSync(
          `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(UGRD|VGRD):(${varLevels}):" -grib_out ${folder}/${fileID}_uvgrd.grib2`,
        );
        slicedGribs.push({
          filePath: `${folder}/${fileID}_uvgrd.grib2`,
          variables: ['UGRD', 'VGRD'],
          levels: variablesToLevel.get(variable),
        });
        break;
      case 'UOGRD':
        execSync(
          `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(UOGRD|VOGRD):(${varLevels}):" -grib_out ${folder}/${fileID}_uvogrd.grib2`,
        );
        slicedGribs.push({
          filePath: `${folder}/${fileID}_uvogrd.grib2`,
          variables: ['UOGRD', 'VOGRD'],
          levels: variablesToLevel.get(variable),
        });
        break;
      case 'VGRD':
      case 'VOGRD':
        // Ignore these 2, combined with their u-couterpart
        break;
      default:
        execSync(
          `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(${variable}):(${varLevels}):" -grib_out ${folder}/${fileID}_${variable}.grib2`,
        );
        slicedGribs.push({
          filePath: `${folder}/${fileID}_${variable}.grib2`,
          variables: [variable],
          levels: variablesToLevel.get(variable),
        });
        break;
    }
  });

  fs.unlinkSync(`${folder}/small_${fileID}.grib2`);

  return {
    slicedGribs,
    geoJsons: finalResult,
    runtimes: Array.from(runtimes),
  };
}

module.exports = sliceGribByRegion;
