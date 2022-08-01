require('dotenv').config();
const turf = require('@turf/turf');
const axios = require('axios');
const { setTimeout: sleep } = require('timers/promises');
const path = require('path');
const fsPromise = require('fs/promises');

const {
  competitionUnitStatus,
  dataSources,
} = require('../src/syrf-schema/enums');

const db = require('../src/syrf-schema/index');
// TODO: Change this to dev/prod slicer for actual backfilling, impossible to run this in local as downloading gribs will be too slow
const slicerUrl = 'http://localhost:3000/api/v1';

(async () => {
  // Can only slice when there's information of start time, and on COMPLETED & ONGOING races only
  const nonSlicedCompetitions = await db.CompetitionUnit.findAll({
    attributes: [
      'id',
      'startTime',
      'endTime',
      'boundingBox',
      [
        db.sequelize.fn('count', db.sequelize.col('"slicedWeathers"."id"')),
        'slicedCount',
      ],
    ],
    where: {
      status: {
        [db.Op.in]: [
          competitionUnitStatus.COMPLETED,
          competitionUnitStatus.ONGOING,
        ],
      },
      startTime: {
        [db.Op.ne]: null,
      },
    },
    include: [
      {
        model: db.SlicedWeather,
        as: 'slicedWeathers',
        attributes: [],
        required: false,
      },
      {
        model: db.CalendarEvent,
        as: 'calendarEvent',
        attributes: ['source'],
        required: true,
        where: {
          source: {
            [db.Op.ne]: dataSources.IMPORT,
          },
        },
      },
    ],
    subQuery: false,
    group: [
      '"CompetitionUnit"."id"',
      '"CompetitionUnit"."startTime"',
      '"CompetitionUnit"."endTime"',
      '"CompetitionUnit"."boundingBox"',
      '"calendarEvent"."id"',
      '"calendarEvent"."source"',
    ],
    having: db.sequelize.literal('count("slicedWeathers"."id") = 0'),
  });

  const logFile = path.resolve(__dirname, './failures.txt');
  try {
    await fsPromise.access(logFile);
  } catch (error) {
    await fsPromise.writeFile(logFile, '', 'utf-8');
  }
  const failedData = await fsPromise.readFile(logFile, 'utf-8');
  const failures = new Set(failedData.split('\n'));
  for (let i = 0; i < nonSlicedCompetitions.length; i++) {
    const { id, startTime, endTime, boundingBox } =
      nonSlicedCompetitions[i].toJSON();

    if (failures.has(id)) {
      continue;
    }
    if (!startTime || !endTime || !boundingBox) {
      // Skip
      console.log(
        `Competition ${id} skipped, no startTime, endTime, or boundingBox`,
      );
      failures.add(id);
      continue;
    }
    try {
      await axios.post(slicerUrl, {
        roi: turf.polygon(boundingBox.coordinates),
        startTimeUnixMS: startTime.getTime(),
        endTimeUnixMS: endTime.getTime(),
        payload: {
          raceID: id,
        },
      });
      console.log(`Competition ${id} has been queued into slicer`);
    } catch (err) {
      console.error(
        `Competition ${id} failed to queue into slicer: ${err.message}`,
      );
    }
    await sleep(200);
  }

  if (failures.size > 0) {
    await fsPromise.writeFile(
      logFile,
      Array.from(failures).join('\n'),
      'utf-8',
    );
  }
})();
