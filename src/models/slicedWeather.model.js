module.exports = (sequelize, Sequelize) => {
  const slicedWeather = sequelize.define(
    'SlicedWeathers',
    {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
      },
      model: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      endTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      s3Key: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      fileType: {
        type: Sequelize.ENUM('GRIB', 'JSON'),
        allowNull: false,
      },
      boundingBox: {
        type: Sequelize.GEOMETRY('POLYGON', 4326),
        allowNull: false,
      },
      levels: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
      },
      variables: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
      },
      runtimes: {
        type: Sequelize.ARRAY(Sequelize.DATE),
        allowNull: false,
      },
      competitionUnitId: {
        type: Sequelize.UUID,
        allowNull: true,
      },
    },
    {
      tableName: 'SlicedWeathers',
      timestamps: false,
    },
  );

  return slicedWeather;
};
