const logger = require('../logger');
const db = require('../models');

exports.addNewSkippedCompetition = async ({
  competitionUnitId,
  totalFileCount,
  message,
}) => {
  try {
    await db.skippedCompetition.create({
      competitionUnitId,
      totalFileCount: totalFileCount || 0,
      message: message || 'Canceled (no message provided)',
    });
  } catch (err) {
    logger.error(`Failed saving skipped competition record: ${err.message}`);
  }
};

exports.checkSkippedCompetition = async (competitionUnitId) => {
  const data = await db.skippedCompetition.findOne({
    where: {
      competitionUnitId,
    },
  });
  return !!data;
};
