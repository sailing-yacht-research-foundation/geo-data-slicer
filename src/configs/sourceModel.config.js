const VALID_TIMEFRAME = {
  GFS: 3600000,
  RTOFS: 3600000,
  ARPEGE_WORLD: 10800000,
  ARPEGE_EUROPE: 3600000,
  AROME_FRANCE: 3600000,
  AROME_FRANCE_HD: 3600000,
  RTOFS_FORECAST_WESTERN_CONUS: 3600000,
  RTOFS_FORECAST_WESTERN_ATLANTIC: 3600000,
  HRRR_SUB_HOURLY: 900000,
};

const INCLUDED_LEVELS = {
  ARPEGE_WORLD: [
    // 'mean sea level',
    '10 m above ground',
    // '2 m above ground', // Contains TMP & RH for 2 m above ground, ignoring
    // 'atmos col',
    'surface',
  ],
  // GFS: ['10 m above ground', '40 m above ground'],
  RTOFS_GLOBAL: ['0 m below sea level'],
  // Regionals
  AROME_FRANCE: [
    // 'mean sea level',
    '10 m above ground',
    // '2 m above ground',
    // 'atmos col',
    'surface',
  ],
  AROME_FRANCE_HD: [
    '10 m above ground',
    // '2 m above ground'
  ],
  ARPEGE_EUROPE: [
    // 'mean sea level',
    '10 m above ground',
    // '2 m above ground',
    // 'atmos col',
    'surface',
  ],
  RTOFS_FORECAST_WESTERN_CONUS: ['0 m below sea level'],
  RTOFS_FORECAST_WESTERN_ATLANTIC: ['0 m below sea level'],
  HRRR_SUB_HOURLY: ['10 m above ground', 'surface'],
};

const MODELS = {
  era5: 'ERA5',
};

module.exports = { INCLUDED_LEVELS, VALID_TIMEFRAME, MODELS };
