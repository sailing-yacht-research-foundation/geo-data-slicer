const execSync = require('child_process').execSync;
const dayjs = require('dayjs');

const makeGeoJsons = require('./makeGeoJsons');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

function sliceGribByPoint(point, filename) {
  const [lon, lat] = point.geometry.coordinates;

  const data = execSync(
    `wgrib2 ${filename} -VT -var -lev -lon ${lon} ${lat}`,
  ).toString();
  execSync(`rm ${filename}`);
  const rows = data.split('\n');
  const finalData = [];
  rows.forEach((row) => {
    if (row !== '') {
      const datums = row.split(':');
      const time = dayjs(datums[2].split('=')[1], 'YYYYMMDDHHmmss');
      const variable = datums[3]; // VRGD UGRD etc
      const level = datums[4];
      const values = datums[5].split(',');
      let lon = values[0].split('=')[1];
      if (lon > 180) {
        lon = String(Number(lon) - 360);
      }
      const lat = values[1].split('=')[1];
      const value = values[2].split('=')[1];
      finalData.push({
        time: time.format('YYYY-MM-DD HH:mm:ss'),
        variable,
        level,
        lon,
        lat,
        value: Number(value),
      });
    }
  });

  const geoJsons = makeGeoJsons(finalData);

  const finalResult = geoJsons.filter((geoJson) => {
    return (
      geoJson.properties.level === '10 m above ground' ||
      geoJson.properties.level === 'surface'
    );
  });

  return finalResult;
}

module.exports = sliceGribByPoint;
