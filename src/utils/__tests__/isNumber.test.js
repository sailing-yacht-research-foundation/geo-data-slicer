const isNumber = require('../isNumber');

describe('Function to check whether variable is a valid number', () => {
  it('should return true when given an actual number', () => {
    expect(isNumber(101)).toEqual(true);
    expect(isNumber(3.14)).toEqual(true);
  });

  it('should return false when given invalid number', () => {
    expect(isNumber(NaN)).toEqual(false);
    expect(isNumber('eight')).toEqual(false);
    expect(isNumber([])).toEqual(false);
    expect(isNumber({})).toEqual(false);
    expect(isNumber(null)).toEqual(false);
  });
});
