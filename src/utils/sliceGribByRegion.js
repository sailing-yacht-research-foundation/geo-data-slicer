const fs = require('fs');
const { promisify } = require('util');
const exec = require('child_process').exec;
const execPromise = promisify(require('child_process').exec);
const deleteFile = promisify(fs.unlink);

const { INCLUDED_LEVELS } = require('../configs/sourceModel.config');
const csvToGeoJson = require('./csvToGeoJson');
const logger = require('../logger');

async function sliceGribByRegion(bbox, filename, options) {
  let { fileID, folder, model, searchStartTime, searchEndTime, sliceJson } =
    options;
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

    if (!sliceJson) {
      // Keep the process to csv, to get the available levels, and variables
      // TODO: Need to modify the bounding box based on the grib, since non-global grib might not have the 1-2 area
      const { stdout: infoOutput } = await execPromise(
        `wgrib2 ${filename} -V -d 1`,
      );

      const outputArray = infoOutput.split('\n');
      let latitude = 0;
      let longitude = 0;
      outputArray.forEach((line) => {
        const lineData = line.trim().split(' ');
        if (lineData[0] === 'lat') {
          latitude = Number(lineData[1]);
        }
        if (lineData[0] === 'lon') {
          longitude = Number(lineData[1]);
        }
      });
      console.log(`Splitting with ${longitude}, ${latitude}`);
      await execPromise(
        `wgrib2 ${filename} ${matchString} -small_grib ${longitude}:${longitude} ${latitude}:${latitude} ${folder}/sampling_${fileID}.grib2`,
      );
      await execPromise(
        `wgrib2 ${folder}/sampling_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
      );

      await deleteFile(`${folder}/sampling_${fileID}.grib2`);
    } else {
      await execPromise(
        `wgrib2 ${folder}/small_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
      );
    }
    const { runtimes, variablesToLevel, geoJsons } = await csvToGeoJson({
      id: fileID,
      model,
      searchStartTime,
      searchEndTime,
      csvFilePath: `${folder}/${fileID}.csv`,
    });

    await Promise.all([
      deleteFile(`${folder}/${fileID}.csv`),
      deleteFile(filename),
    ]);

    let slicedGribs = [];
    // TODO: Add slicing again, by time. Need to make sure we get the correct time slices.
    // Only need to do if runtimes length is greater than 1.
    // If it is, need to calculate the difference betweeneach time. That will be the duration. Is it within the competition time
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
    await deleteFile(`${folder}/small_${fileID}.grib2`);

    return {
      slicedGribs,
      geoJsons: sliceJson ? geoJsons : [],
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
