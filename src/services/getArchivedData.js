const db = require("../models");
const Op = db.Sequelize.Op;

// roi: region of interest (polygon)
async function getArchivedData(roi, startTime, endTime) {
  /** TODO
   *      a) Check size of roi and react accordingly. Maybe we need a util to calculate sizes of things and adjust our approach accordingly. Maybe we need a way to just determine is roi oceanic or local.
   *      b) Query PostGIS for space and time boundaries to get a list of s3 files.
   *      c) Download said s3 files.
   *      d) Slice GRIBs into regions using wgrib2 or cdo, then convert to geojson and (either upload gribs and geojson to s3 and save the record or send this info to the analysis engine so it can do it).
   *      e) Return with a either a list of sliced files in an s3 bucket just for sliced data, or actually return the geojson objects with time and boundary info.
   */

  // Query PostGIS for space and time boundaries to get a list of s3 files
  const query = `SELECT "model_name" FROM "SourceModels" WHERE ST_Contains ( "spatial_boundary", ST_GeomFromText ( :polygon, 4326 ) )`;
  const result = await db.sequelize.query(query, {
    replacements: {
      polygon: `POLYGON((${roi.geometry.coordinates[0]
        .map((row) => {
          return `${row[0]} ${row[1]}`;
        })
        .join(",")}))`,
    },
    type: db.sequelize.QueryTypes.SELECT,
  });

  let modelsToFetch = ["GFS", "RTOFS_GLOBAL", "ARPEGE_WORLD"];
  if (result.length > 0) {
    modelsToFetch = [
      ...modelsToFetch,
      ...result.map((row) => {
        return row.model_name;
      }),
    ];
  }

  const startDate = new Date(startTime);
  const endDate = new Date(endTime);
  const files = await db.weatherData.findAll({
    where: {
      model: { [Op.in]: modelsToFetch },
      [Op.or]: [
        {
          start_time: {
            [Op.between]: [startDate, endDate],
          },
        },
        {
          end_time: {
            [Op.between]: [startDate, endDate],
          },
        },
      ],
    },
    raw: true,
  });

  // Download said s3 files.
  // Slice GRIBs into regions using wgrib2 or cdo, then convert to geojson and (either upload gribs and geojson to s3 and save the record or send this info to the analysis engine so it can do it).
  // Return with a either a list of sliced files in an s3 bucket just for sliced data, or actually return the geojson objects with time and boundary info.

  return files;
}

module.exports = getArchivedData;
