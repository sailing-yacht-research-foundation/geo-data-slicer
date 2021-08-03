const weatherSourceToFeatureCollection = require('../weatherSourceToFeatureCollection');

describe('Function to create geojson feature collection from data', () => {
  it('should generate feature collection when supplied with location data', () => {
    const sourceList = [
      { lon: 1, lat: 1, otherData: 'a' },
      { lon: 1, lat: 2, otherData: 'b' },
      { lon: 1, lat: 3, otherData: 'c' },
      { lon: 1, lat: 4, otherData: 'd' },
    ];
    expect(weatherSourceToFeatureCollection(sourceList)).toEqual({
      features: [
        {
          geometry: {
            coordinates: [1, 1],
            type: 'Point',
          },
          properties: {
            otherData: 'a',
          },
          type: 'Feature',
        },
        {
          geometry: {
            coordinates: [1, 2],
            type: 'Point',
          },
          properties: {
            otherData: 'b',
          },
          type: 'Feature',
        },
        {
          geometry: {
            coordinates: [1, 3],
            type: 'Point',
          },
          properties: {
            otherData: 'c',
          },
          type: 'Feature',
        },
        {
          geometry: {
            coordinates: [1, 4],
            type: 'Point',
          },
          properties: {
            otherData: 'd',
          },
          type: 'Feature',
        },
      ],
      type: 'FeatureCollection',
    });
  });
  it('should ignore non-valid location data', () => {
    const sourceList = [
      { lon: 1, lat: 1, otherData: 'a' },
      { lon: null, lat: 2, otherData: 'b' },
      { lon: 1, lat: null, otherData: 'c' },
      { lon: 1, lat: 4, otherData: 'd' },
    ];
    expect(weatherSourceToFeatureCollection(sourceList)).toEqual({
      features: [
        {
          geometry: {
            coordinates: [1, 1],
            type: 'Point',
          },
          properties: {
            otherData: 'a',
          },
          type: 'Feature',
        },
        {
          geometry: {
            coordinates: [1, 4],
            type: 'Point',
          },
          properties: {
            otherData: 'd',
          },
          type: 'Feature',
        },
      ],
      type: 'FeatureCollection',
    });
  });
  it('should generate empty feature collection when supplied with empty array', () => {
    expect(weatherSourceToFeatureCollection([])).toEqual({
      features: [],
      type: 'FeatureCollection',
    });
  });
});
