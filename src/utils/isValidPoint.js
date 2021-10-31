function isValidPoint(data) {
  const { geometry } = data;
  if (!geometry) {
    return {
      valid: false,
      message: 'No geometry propery can be found',
    };
  }
  if (geometry.type !== 'Point') {
    return {
      valid: false,
      message: 'Wrong geometry type provided',
    };
  }
  if (
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length === 2
  ) {
    return {
      valid: true,
      message: '',
    };
  } else {
    return {
      valid: false,
      message: 'Coordinates invalid',
    };
  }
}

module.exports = isValidPoint;
