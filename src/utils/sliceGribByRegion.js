const fs = require('fs');
const execSync = require('child_process').execSync;

const parseCsvData = require('./parseCsvData');
const makeGeoJsons = require('./makeGeoJsons');

const INCLUDED_LEVELS = {
  ARPEGE_WORLD: [
    // 'mean sea level',
    '10 m above ground',
    '2 m above ground',
    // 'atmos col',
    'surface',
  ],
  GFS: ['10 m above ground'],
  RTOFS_GLOBAL: ['0 m below sea level'],
  // Regionals
  AROME_FRANCE: [
    // 'mean sea level',
    '10 m above ground',
    '2 m above ground',
    // 'atmos col',
    'surface',
  ],
  AROME_FRANCE_HD: ['10 m above ground', '2 m above ground'],
  ARPEGE_EUROPE: [
    // 'mean sea level',
    '10 m above ground',
    '2 m above ground',
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
  console.time(`csv-${fileID}`);
  execSync(
    `wgrib2 ${folder}/small_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
  );
  console.timeEnd(`csv-${fileID}`);
  execSync(`rm ${filename}`);
  const csvData = fs.readFileSync(`${folder}/${fileID}.csv`, 'utf-8');
  execSync(`rm ${folder}/${fileID}.csv`);
  const parsedData = parseCsvData(csvData);
  const geoJsons = makeGeoJsons(parsedData);

  const finalResult = geoJsons.filter((geoJson) => {
    if (INCLUDED_LEVELS[model]) {
      return INCLUDED_LEVELS[model].indexOf(geoJson.properties.level) !== -1;
    }
    console.log('non registered', model, geoJson.properties.level);
    return true;
    // if (model === 'RTOFS_GLOBAL') {
    //   return geoJson.properties.level === '0 m below sea level';
    // }
    // return (
    //   geoJson.properties.level === '10 m above ground' ||
    //   geoJson.properties.level === 'surface'
    // );
  });
  return {
    slicedGrib: `${folder}/small_${fileID}.grib2`,
    geoJsons: finalResult,
  };
}

module.exports = sliceGribByRegion;
