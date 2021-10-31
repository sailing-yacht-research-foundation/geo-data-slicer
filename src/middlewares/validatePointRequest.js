const isValidPoint = require('../utils/isValidPoint');

module.exports = function (req, res, next) {
  const requiredFields = ['point', 'startTimeUnixMS', 'endTimeUnixMS'];
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

  if (req.body.payload) {
    const { raceID } = req.body.payload;
    if (!raceID) {
      message = 'Payload defined, required: raceID';
    } else {
      if (
        !String(raceID).match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        )
      ) {
        message = 'Invalid format: raceID';
      }
    }
  }

  if (message !== '') {
    res.status(400).json({ message });
  } else {
    next();
  }
};
