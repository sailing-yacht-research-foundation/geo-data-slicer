const express = require('express');

const version = require('../../package.json').version;
const modelVersion = require('../syrf-schema/package.json').version;

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
    version,
    modelVersion,
    era5: {
      queue: eraQueueInfo,
      activeJobs: eraActiveJobs.map((row) => {
        const { id, timestamp, processedOn, progress } = row;

        const { metadata } = row.data;
        return {
          id,
          timestamp,
          processedOn,
          progress,
          metadata,
        };
      }),
    },
    slicer: {
      queue: slicerQueueInfo,
      activeJobs: slicerActiveJobs.map((row) => {
        const { id, timestamp, progress, processedOn } = row;

        return {
          id,
          timestamp,
          processedOn,
          progress: progress.progressValue,
          metadata: progress,
        };
      }),
    },
  });
});

module.exports = router;
