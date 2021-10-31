const isValidPoint = require('../isValidPoint');

describe('Function to check whether a geojson is a point', () => {
  it('should return true when given a valid point', () => {
    expect(
      isValidPoint({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-3.6, 53.6],
        },
      }),
    ).toEqual({
      valid: true,
      message: '',
    });
  });

  it('should return false when given invalid polygon', () => {
    expect(
      isValidPoint({
        type: 'Feature',
        properties: {},
      }),
    ).toEqual({
      valid: false,
      message: 'No geometry propery can be found',
    });

    expect(
      isValidPoint({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [-4.625244140625, 53.28492154619624],
              [-2.98828125, 53.28492154619624],
              [-2.98828125, 54.28446875235516],
              [-4.625244140625, 54.28446875235516],
              [-4.625244140625, 53.28492154619624],
            ],
          ],
        },
      }),
    ).toEqual({
      valid: false,
      message: 'Wrong geometry type provided',
    });

    expect(
      isValidPoint({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [],
        },
      }),
    ).toEqual({
      valid: false,
      message: 'Coordinates invalid',
    });
  });
});
