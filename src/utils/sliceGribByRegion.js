const fs = require('fs');
const execSync = require('child_process').execSync;
const turf = require('@turf/turf');

const makeGeoJsons = require('./makeGeoJsons');

function sliceGribByRegion(roi, filename, options) {
  // TODO: Does different model have different ways to slice? Need to check
  let { fileID, folder, model } = options;
  let bbox = turf.bbox(roi);
  const leftLon = bbox[0];
  const bottomLat = bbox[1];
  const rightLon = bbox[2];
  const topLat = bbox[3];

  execSync(
    'wgrib2 ' +
      filename +
      ' -small_grib ' +
      leftLon +
      ':' +
      rightLon +
      ' ' +
      bottomLat +
      ':' +
      topLat +
      ` ${folder}/small_${fileID}.grib2`,
  );
  execSync(`rm ${filename}`);
  execSync(
    `wgrib2 ${folder}/small_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
  );
  execSync(`rm ${folder}/small_${fileID}.grib2`);
  const csvData = fs.readFileSync(`${folder}/${fileID}.csv`, 'utf-8');
  execSync(`rm ${folder}/${fileID}.csv`);
  const parsedData = makeGeoJsons(csvData);
  const geoJsons = parsedData.geoJsons;
  const indicies = parsedData.indices;

  //   var counter = 0;
  //   const jsonFiles = [];
  //   geoJsons.forEach((geoJson) => {
  //     if (
  //       geoJson.properties.level === "10 m above ground" ||
  //       geoJson.properties.level === "surface"
  //     ) {
  //       const jsonFilePath = `${folder}/${fileID}_${counter.toString()}.json`;
  //       fs.writeFileSync(jsonFilePath, JSON.stringify(geoJson));
  //       jsonFiles.push(jsonFilePath);
  //       counter++;
  //     }
  //   });
  //   return jsonFiles;
  return geoJsons;
}

module.exports = sliceGribByRegion;
