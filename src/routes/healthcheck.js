const express = require('express');

const era5Queue = require('../queues/era5Queue');
const slicerQueue = require('../queues/slicerQueue');

const router = express.Router();

router.get('/', async function (req, res) {
  const eraQueueInfo = await era5Queue.getQueueSize();
  const eraActiveJobs = await era5Queue.getActiveJobs();
  const slicerQueueInfo = await slicerQueue.getQueueSize();
  const slicerActiveJobs = await slicerQueue.getActiveJobs();

  res.send({
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
    era5: {
      queue: eraQueueInfo,
      activeJobs: eraActiveJobs.map((row) => {
        const { id, timestamp, processedOn } = row;
        return {
          id,
          timestamp: new Date(timestamp).toISOString(),
          processedOn: new Date(processedOn).toISOString(),
        };
      }),
    },
    slicer: {
      queue: slicerQueueInfo,
      activeJobs: slicerActiveJobs.map((row) => {
        const { id, timestamp, processedOn } = row;
        return {
          id,
          timestamp: new Date(timestamp).toISOString(),
          processedOn: new Date(processedOn).toISOString(),
        };
      }),
    },
  });
});

module.exports = router;
