function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}

module.exports = isNumber;
