const isValidPolygon = require('../isValidPolygon');

describe('Function to check whether a geojson is a polygon', () => {
  it('should return true when given a valid polygon', () => {
    const validPolygon = {
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
    };

    expect(isValidPolygon(validPolygon)).toEqual({
      valid: true,
      message: '',
    });
  });

  it('should return false when given invalid polygon', () => {
    expect(
      isValidPolygon({
        type: 'Feature',
        properties: {},
      }),
    ).toEqual({
      valid: false,
      message: 'No geometry propery can be found',
    });

    expect(
      isValidPolygon({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Point',
          coordinates: [-3.6, 53.6],
        },
      }),
    ).toEqual({
      valid: false,
      message: 'Wrong geometry type provided',
    });

    expect(
      isValidPolygon({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [[]],
        },
      }),
    ).toEqual({
      valid: false,
      message: 'Empty Coordinates',
    });

    expect(
      isValidPolygon({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: 'earth',
        },
      }),
    ).toEqual({
      valid: false,
      message: 'Coordinates invalid',
    });
  });
});
