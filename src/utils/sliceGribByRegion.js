const fs = require('fs');
const { promisify } = require('util');
const execPromise = promisify(require('child_process').exec);
const deleteFile = promisify(fs.unlink);

const { INCLUDED_LEVELS } = require('../configs/sourceModel.config');
const csvToGeoJson = require('./csvToGeoJson');
const logger = require('../logger');

async function sliceGribByRegion(bbox, filename, options) {
  let { fileID, folder, model, searchStartTime, searchEndTime } = options;
  // Need to round up and down values, so that bounding box doesn't become too small
  // https://www.cpc.ncep.noaa.gov/products/wesley/wgrib2/small_grib.html
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);

  try {
    let matchString = '';
    if (INCLUDED_LEVELS[model]) {
      matchString = `-match ":(${INCLUDED_LEVELS[model].join('|')}):"`;
    }
    await execPromise(
      `wgrib2 ${filename} ${matchString} -small_grib ${leftLon}:${rightLon} ${bottomLat}:${topLat} ${folder}/small_${fileID}.grib2`,
    );
    await execPromise(
      `wgrib2 ${folder}/small_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
    );
    await deleteFile(filename);

    const { runtimes, variablesToLevel, geoJsons } = await csvToGeoJson({
      id: fileID,
      model,
      searchStartTime,
      searchEndTime,
      csvFilePath: `${folder}/${fileID}.csv`,
    });
    await deleteFile(`${folder}/${fileID}.csv`);
    let slicedGribs = [];
    await Promise.all(
      Array.from(variablesToLevel.keys()).map(async (varGroup) => {
        const levelsAvailable = variablesToLevel.get(varGroup);
        if (levelsAvailable && levelsAvailable.length > 0) {
          let varLevels = Array.from(levelsAvailable).join('|');
          switch (varGroup) {
            case 'uvgrd':
              await Promise.all(
                levelsAvailable.map(async (level) => {
                  await execPromise(
                    `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(UGRD|VGRD):(${level}):" -grib_out ${folder}/${fileID}_uvgrd_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                  );
                  slicedGribs.push({
                    filePath: `${folder}/${fileID}_uvgrd_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                    variables: ['UGRD', 'VGRD'],
                    levels: [level],
                  });
                }),
              );
              break;
            case 'uvogrd':
              await Promise.all(
                levelsAvailable.map(async (level) => {
                  await execPromise(
                    `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(UOGRD|VOGRD):(${varLevels}):" -grib_out ${folder}/${fileID}_uvogrd_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                  );
                  slicedGribs.push({
                    filePath: `${folder}/${fileID}_uvogrd_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                    variables: ['UOGRD', 'VOGRD'],
                    levels: [level],
                  });
                }),
              );
              break;
            case 'uvgust':
              await Promise.all(
                levelsAvailable.map(async (level) => {
                  await execPromise(
                    `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(UGUST|VGUST):(${varLevels}):" -grib_out ${folder}/${fileID}_uvgust_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                  );
                  slicedGribs.push({
                    filePath: `${folder}/${fileID}_uvgust_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                    variables: ['UGUST', 'VGUST'],
                    levels: [level],
                  });
                }),
              );
              break;
            default:
              await Promise.all(
                levelsAvailable.map(async (level) => {
                  await execPromise(
                    `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(${varGroup}):(${varLevels}):" -grib_out ${folder}/${fileID}_${varGroup}_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                  );
                  slicedGribs.push({
                    filePath: `${folder}/${fileID}_${varGroup}_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                    variables: [varGroup],
                    levels: [level],
                  });
                }),
              );
              break;
          }
        }
      }),
    );
    fs.unlinkSync(`${folder}/small_${fileID}.grib2`);

    return {
      slicedGribs,
      geoJsons,
      runtimes: Array.from(runtimes),
    };
  } catch (error) {
    console.trace(error);
    logger.error(`Error slicing grib by region: ${error.message}`);
    return {
      slicedGribs: [],
      geoJsons: [],
      runtimes: [],
    };
  }
}

module.exports = sliceGribByRegion;
