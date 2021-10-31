// time, variable, level, lon, lat, value
const makeGeoJsons = require('../makeGeoJsons');

describe('Function to create geojson from grib data', () => {
  it('should combine vector values together', () => {
    const data = [
      {
        time: '2021-07-01 18:00:00',
        variable: 'UGRD',
        level: '10 m above ground',
        lon: '5',
        lat: '53',
        value: -1.27292,
      },
      {
        time: '2021-07-01 18:00:00',
        variable: 'VGRD',
        level: '10 m above ground',
        lon: '5',
        lat: '53',
        value: -5.82039,
      },
      {
        time: '2021-07-01 18:00:00',
        variable: 'GUST',
        level: '10 m above ground',
        lon: '5',
        lat: '53',
        value: 5,
      },
      {
        time: '2021-07-01 18:00:00',
        variable: 'WIND',
        level: '10 m above ground',
        lon: '5',
        lat: '53',
        value: 5,
      },
      {
        time: '2021-07-01 18:00:00',
        variable: 'UOGRD',
        level: '10 m above ground',
        lon: '5',
        lat: '53',
        value: -1.27292,
      },
      {
        time: '2021-07-01 18:00:00',
        variable: 'VOGRD',
        level: '10 m above ground',
        lon: '5',
        lat: '53',
        value: -5.82039,
      },
    ];
    expect(makeGeoJsons(data)).toEqual(
      expect.arrayContaining([
        {
          features: [
            {
              geometry: { coordinates: [5, 53], type: 'Point' },
              properties: { UGRD: -1.27292, VGRD: -5.82039 },
              type: 'Feature',
            },
          ],
          properties: {
            level: '10 m above ground',
            time: '2021-07-01 18:00:00',
          },
          type: 'FeatureCollection',
        },
        {
          features: [
            {
              geometry: { coordinates: [5, 53], type: 'Point' },
              properties: { UOGRD: -1.27292, VOGRD: -5.82039 },
              type: 'Feature',
            },
          ],
          properties: {
            level: '10 m above ground',
            time: '2021-07-01 18:00:00',
          },
          type: 'FeatureCollection',
        },
      ]),
    );
  });
});
