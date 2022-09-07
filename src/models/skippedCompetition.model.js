module.exports = (sequelize, Sequelize) => {
  const skippedCompetition = sequelize.define(
    'SkippedCompetitions',
    {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.DataTypes.UUIDV1,
        allowNull: false,
        primaryKey: true,
      },
      competitionUnitId: {
        type: Sequelize.UUID,
        allowNull: false,
      },
      totalFileCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: 'SkippedCompetitions',
      timestamps: false,
    },
  );

  return skippedCompetition;
};
