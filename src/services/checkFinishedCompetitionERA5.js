const logger = require('../logger');

const db = require('../syrf-schema/index');
const era5Queue = require('../queues/era5Queue');
const { MODELS } = require('../configs/sourceModel.config');
const { competitionUnitStatus } = require('../syrf-schema/enums');

async function checkFinishedCompetitionERA5() {
  logger.info('Start checking finished competition ended 7 days ago');
  const filterStartDate = new Date();
  filterStartDate.setUTCDate(filterStartDate.getUTCDate() - 8);
  filterStartDate.setUTCHours(0);
  filterStartDate.setUTCMinutes(0);
  filterStartDate.setUTCSeconds(0);
  const filterEndDate = new Date();
  filterEndDate.setUTCDate(filterEndDate.getUTCDate() - 7);
  filterEndDate.setUTCHours(0);
  filterEndDate.setUTCMinutes(0);
  filterEndDate.setUTCSeconds(0);

  let competitions = [];
  try {
    competitions = await db.CompetitionUnit.findAll({
      attributes: [
        'id',
        'name',
        'startTime',
        'endTime',
        [
          db.sequelize.fn('count', db.sequelize.col('"slicedWeathers"."id"')),
          'slicedCount',
        ],
      ],
      where: {
        status: competitionUnitStatus.COMPLETED,
        startTime: {
          [db.Op.ne]: null,
        },
        endTime: {
          [db.Op.gte]: filterStartDate,
          [db.Op.lt]: filterEndDate,
        },
        boundingBox: {
          [db.Op.ne]: null,
        },
      },
      include: [
        {
          model: db.SlicedWeather,
          as: 'slicedWeathers',
          attributes: [],
          required: false,
          where: {
            model: MODELS.era5,
          },
        },
      ],
      subQuery: false,
      group: [
        '"CompetitionUnit"."id"',
        '"CompetitionUnit"."name"',
        '"CompetitionUnit"."startTime"',
        '"CompetitionUnit"."endTime"',
      ],
      having: db.sequelize.literal('count("slicedWeathers"."id") = 0'),
    });
  } catch (error) {
    console.trace(error);
  }

  logger.info(
    `Found ${
      competitions.length
    } ending between ${filterStartDate.toISOString()} to ${filterEndDate.toISOString()} with 0 ERA5 sliced files.`,
  );

  for (let i = 0; i < competitions.length; i++) {
    const {
      id: competitionUnitId,
      name: competitionName,
      endTime,
    } = competitions[i];
    logger.info(
      `Queuing competition ${competitionUnitId} - ${competitionName} which ended on ${endTime.toISOString()}`,
    );
    era5Queue.addJob(
      {
        competitionUnitId,
      },
      { jobId: competitionUnitId },
    );
  }
}

module.exports = checkFinishedCompetitionERA5;
