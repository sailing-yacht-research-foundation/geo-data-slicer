// roi: region of interest (polygon)
function getArchivedData(roi, startTime, endTime) {
  /** TODO
   *      a) Check size of roi and react accordingly. Maybe we need a util to calculate sizes of things and adjust our approach accordingly. Maybe we need a way to just determine is roi oceanic or local.
   *      b) Query PostGIS for space and time boundaries to get a list of s3 files.
   *      c) Download said s3 files.
   *      d) Slice GRIBs into regions using wgrib2 or cdo, then convert to geojson and (either upload gribs and geojson to s3 and save the record or send this info to the analysis engine so it can do it).
   *      e) Return with a either a list of sliced files in an s3 bucket just for sliced data, or actually return the geojson objects with time and boundary info.
   */
}

module.exports = getArchivedData;
