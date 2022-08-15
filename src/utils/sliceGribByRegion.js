const fs = require('fs');
const { promisify } = require('util');
const execPromise = promisify(require('child_process').exec);
const deleteFile = promisify(fs.unlink);
const dayjs = require('dayjs');

const { INCLUDED_LEVELS } = require('../configs/sourceModel.config');
const csvToGeoJson = require('./csvToGeoJson');
const logger = require('../logger');

const customParseFormat = require('dayjs/plugin/customParseFormat');
const mapERA5Variables = require('./mapERA5Variables');
dayjs.extend(customParseFormat);

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
    await deleteFile(filename);
    if (!sliceJson) {
      // Keep the process to csv, to get the available levels, and variables
      // This cmd executes will return first data, to make sure we use valid lon lat available in the grib
      const { stdout: infoOutput } = await execPromise(
        `wgrib2 ${folder}/small_${fileID}.grib2 -V -d 1`,
      );

      const outputArray = infoOutput?.split('\n');
      let latitude = 0;
      let longitude = 0;
      outputArray?.forEach((line) => {
        const lineData = line.trim().split(' ');
        if (lineData[0] === 'lat') {
          latitude = Number(lineData[1]);
        }
        if (lineData[0] === 'lon') {
          longitude = Number(lineData[1]);
        }
      });
      // Create a very small grib (minimal) to create a small csv that will be used just to list the available levels, variables, runtimes
      await execPromise(
        `wgrib2 ${folder}/small_${fileID}.grib2 ${matchString} -small_grib ${longitude}:${longitude} ${latitude}:${latitude} ${folder}/sampling_${fileID}.grib2`,
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
      folder,
      sliceJson,
    });

    await deleteFile(`${folder}/${fileID}.csv`);

    let slicedGribs = [];
    await Promise.all(
      runtimes.map(async (runtime) => {
        const filterTime = dayjs(runtime, 'YYYY-MM-DD HH:mm:ss+00').format(
          'YYYYMMDDHHmmss',
        );
        await Promise.all(
          Array.from(variablesToLevel.keys()).map(async (varGroup) => {
            const levelsAvailable = variablesToLevel.get(varGroup);
            if (levelsAvailable && levelsAvailable.length > 0) {
              switch (varGroup) {
                case 'uvgrd':
                  await Promise.all(
                    levelsAvailable.map(async (level) => {
                      const filePath = `${folder}/${fileID}_uvgrd_${filterTime}_${level.replace(
                        / /g,
                        '_',
                      )}.grib2`;
                      await execPromise(
                        `wgrib2 ${folder}/small_${fileID}.grib2 -Match_inv -match ":(UGRD|VGRD):(${level}):" -match ":start_FT=${filterTime}:" -grib_out ${filePath}`,
                      );
                      slicedGribs.push({
                        filePath,
                        variables: ['UGRD', 'VGRD'],
                        levels: [level],
                        runtimes: [runtime],
                      });
                    }),
                  );
                  break;
                case 'uvogrd':
                  await Promise.all(
                    levelsAvailable.map(async (level) => {
                      const filePath = `${folder}/${fileID}_uvogrd_${filterTime}_${level.replace(
                        / /g,
                        '_',
                      )}.grib2`;
                      await execPromise(
                        `wgrib2 ${folder}/small_${fileID}.grib2 -Match_inv -match ":(UOGRD|VOGRD):(${level}):" -match ":start_FT=${filterTime}:" -grib_out ${filePath}`,
                      );
                      slicedGribs.push({
                        filePath,
                        variables: ['UOGRD', 'VOGRD'],
                        levels: [level],
                        runtimes: [runtime],
                      });
                    }),
                  );
                  break;
                case 'uvgust':
                  await Promise.all(
                    levelsAvailable.map(async (level) => {
                      const filePath = `${folder}/${fileID}_uvgust_${filterTime}_${level.replace(
                        / /g,
                        '_',
                      )}.grib2`;
                      await execPromise(
                        `wgrib2 ${folder}/small_${fileID}.grib2 -Match_inv -match ":(UGUST|VGUST):(${level}):" -match ":start_FT=${filterTime}:" -grib_out ${filePath}`,
                      );
                      slicedGribs.push({
                        filePath,
                        variables: ['UGUST', 'VGUST'],
                        levels: [level],
                        runtimes: [runtime],
                      });
                    }),
                  );
                  break;
                default:
                  const mappedVarName = mapERA5Variables(varGroup);
                  await Promise.all(
                    levelsAvailable.map(async (level) => {
                      const filePath = `${folder}/${fileID}_${varGroup}_${filterTime}_${level.replace(
                        / /g,
                        '_',
                      )}.grib2`;
                      await execPromise(
                        `wgrib2 ${folder}/small_${fileID}.grib2 -Match_inv -match ":(${varGroup}):(${level}):" -match ":start_FT=${filterTime}:" -grib_out ${filePath}`,
                      );
                      slicedGribs.push({
                        filePath,
                        variables: [mappedVarName],
                        levels: [level],
                        runtimes: [runtime],
                      });
                    }),
                  );
                  break;
              }
            }
          }),
        );
      }),
    );

    await deleteFile(`${folder}/small_${fileID}.grib2`);

    return {
      slicedGribs,
      geoJsons: sliceJson ? geoJsons : [],
    };
  } catch (error) {
    console.trace(error);
    logger.error(`Error slicing grib by region: ${error.message}`);
    return {
      slicedGribs: [],
      geoJsons: [],
    };
  }
}

module.exports = sliceGribByRegion;
