function isValidPolygon(data) {
  const { geometry } = data;
  if (!geometry) {
    return {
      valid: false,
      message: 'No geometry propery can be found',
    };
  }
  if (geometry.type !== 'Polygon') {
    return {
      valid: false,
      message: 'Wrong geometry type provided',
    };
  }
  if (Array.isArray(geometry.coordinates)) {
    if (geometry.coordinates[0].length === 0) {
      return {
        valid: false,
        message: 'Empty Coordinates',
      };
    }
  } else {
    return {
      valid: false,
      message: 'Coordinates invalid',
    };
  }
  return {
    valid: true,
    message: '',
  };
}

module.exports = isValidPolygon;
