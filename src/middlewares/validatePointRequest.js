module.exports = function (req, res, next) {
  const requiredFields = [
    'point',
    'startTimeUnixMS',
    'endTimeUnixMS',
    'webhook',
  ];
  const missingFields = requiredFields.filter((field) => {
    if (!req.body[field]) {
      return true;
    }
  });
  let invalid = false;
  if (missingFields.length > 0) {
    invalid = true;
    res.status(400).json({
      message: `Fields required: ${missingFields.join(', ')}`,
    });
  }

  if (!invalid) {
    next();
  }
};
