const MAX_AREA_CONCURRENT_RUN = 200000000000; // in m2, 4x4 lonxlat = 197960531766
const CONCURRENT_SLICE_REQUEST = Number(
  process.env.CONCURRENT_SLICE_REQUEST || '4',
);

const WEATHER_FILE_TYPES = {
  grib: 'GRIB',
  json: 'JSON',
};

const SLICING_STUCK_THRESHOLD = 600000;
const ERA5_STUCK_THRESHOLD = 3600000;

module.exports = {
  MAX_AREA_CONCURRENT_RUN,
  CONCURRENT_SLICE_REQUEST,
  WEATHER_FILE_TYPES,
  SLICING_STUCK_THRESHOLD,
  ERA5_STUCK_THRESHOLD,
};
