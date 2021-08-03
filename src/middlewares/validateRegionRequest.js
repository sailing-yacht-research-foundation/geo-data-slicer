const isValidPolygon = require('../utils/isValidPolygon');

module.exports = function (req, res, next) {
  const requiredFields = ['roi', 'startTimeUnixMS', 'endTimeUnixMS', 'webhook'];
  const missingFields = requiredFields.filter((field) => {
    if (!req.body[field]) {
      return true;
    }
  });
  let message = '';
  if (missingFields.length > 0) {
    message = `Fields required: ${missingFields.join(', ')}`;
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

  if (req.body.roi) {
    const { valid, message: vpMessage } = isValidPolygon(req.body.roi);
    if (!valid) {
      message = `Invalid roi: ${vpMessage}`;
    }
  }

  if (message !== '') {
    res.status(400).json({ message });
  } else {
    next();
  }
};
