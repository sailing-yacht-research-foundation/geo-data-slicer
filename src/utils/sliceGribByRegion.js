const fs = require('fs');
const { promisify } = require('util');
const execPromise = promisify(require('child_process').exec);
const readFile = promisify(fs.readFile);

const parseCsvData = require('./parseCsvData');
const makeGeoJsons = require('./makeGeoJsons');
const csvToGeoJson = require('./csvToGeoJson');
const logger = require('../logger');

async function sliceGribByRegion(bbox, filename, options) {
  let { fileID, folder, model } = options;
  // Need to round up and down values, so that bounding box doesn't become too small
  // https://www.cpc.ncep.noaa.gov/products/wesley/wgrib2/small_grib.html
  const leftLon = Math.floor(bbox[0]);
  const bottomLat = Math.floor(bbox[1]);
  const rightLon = Math.ceil(bbox[2]);
  const topLat = Math.ceil(bbox[3]);

  try {
    await execPromise(
      `wgrib2 ${filename} -small_grib ${leftLon}:${rightLon} ${bottomLat}:${topLat} ${folder}/small_${fileID}.grib2`,
    );
    await execPromise(
      `wgrib2 ${folder}/small_${fileID}.grib2 -csv ${folder}/${fileID}.csv`,
    );
    const used1 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses 1 approximately ${Math.round(used1 * 100) / 100} MB`,
    );
    fs.unlinkSync(filename);

    const { runtimes, variables, variablesToLevel, geoJsons } =
      await csvToGeoJson(
        fileID,
        model,
        await readFile(`${folder}/${fileID}.csv`, 'utf-8'),
      );
    const used2 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses 2 approximately ${Math.round(used2 * 100) / 100} MB`,
    );
    fs.unlinkSync(`${folder}/${fileID}.csv`);
    const used3 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses 3 approximately ${Math.round(used3 * 100) / 100} MB`,
    );
    // const geoJsons = makeGeoJsons(parsedData);
    const used4 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses 4 approximately ${Math.round(used4 * 100) / 100} MB`,
    );

    const used5 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses 5 approximately ${Math.round(used5 * 100) / 100} MB`,
    );
    let slicedGribs = [];
    await Promise.all(
      Array.from(variables).map(async (variable) => {
        const levelsAvailable = variablesToLevel.get(variable);
        if (levelsAvailable && levelsAvailable.length > 0) {
          let varLevels = Array.from(levelsAvailable).join('|');
          switch (variable) {
            case 'UGRD':
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
            case 'UOGRD':
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
            case 'UGUST':
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
            case 'VGRD':
            case 'VOGRD':
            case 'VGUST':
              // Ignore these 3, combined with their u-couterpart
              break;
            default:
              await Promise.all(
                levelsAvailable.map(async (level) => {
                  await execPromise(
                    `wgrib2 ${folder}/small_${fileID}.grib2 -match ":(${variable}):(${varLevels}):" -grib_out ${folder}/${fileID}_${variable}_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                  );
                  slicedGribs.push({
                    filePath: `${folder}/${fileID}_${variable}_${level.replace(
                      / /g,
                      '_',
                    )}.grib2`,
                    variables: [variable],
                    levels: [level],
                  });
                }),
              );
              break;
          }
        }
      }),
    );
    const used6 = process.memoryUsage().heapUsed / 1024 / 1024;
    console.log(
      `The script uses 6 approximately ${Math.round(used6 * 100) / 100} MB`,
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
    logger.error(error);
    return {
      slicedGribs: [],
      geoJsons: [],
      runtimes: [],
    };
  }
}

module.exports = sliceGribByRegion;
