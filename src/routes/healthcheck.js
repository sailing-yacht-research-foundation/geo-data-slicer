const express = require('express');
const router = express.Router();

router.get('/', function (req, res) {
  res.send({
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  });
});

module.exports = router;
