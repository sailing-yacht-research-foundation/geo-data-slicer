const MAX_AREA_CONCURRENT_RUN = 200000000000; // in m2, 4x4 lonxlat = 197960531766

const WEATHER_FILE_TYPES = {
  grib: 'GRIB',
  json: 'JSON',
};

module.exports = {
  MAX_AREA_CONCURRENT_RUN,
  WEATHER_FILE_TYPES,
};
