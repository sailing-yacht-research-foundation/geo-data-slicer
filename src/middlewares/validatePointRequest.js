const isValidPoint = require('../utils/isValidPoint');

module.exports = function (req, res, next) {
  const requiredFields = [
    'point',
    'startTimeUnixMS',
    'endTimeUnixMS',
    'webhook',
  ];
  let message = '';
  const missingFields = requiredFields.filter((field) => {
    if (!req.body[field]) {
      return true;
    }
  });
  if (missingFields.length > 0) {
    message = `Fields required: ${missingFields.join(', ')}`;
  }

  if (req.body.point) {
    const { valid, message: vpMessage } = isValidPoint(req.body.point);
    if (!valid) {
      message = `Invalid point: ${vpMessage}`;
    }
  }

  if (message !== '') {
    res.status(400).json({ message });
  } else {
    next();
  }
};
