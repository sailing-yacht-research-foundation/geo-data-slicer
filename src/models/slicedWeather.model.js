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
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      s3_key: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_type: {
        type: Sequelize.ENUM('GRIB', 'JSON'),
        allowNull: false,
      },
      bounding_box: {
        type: Sequelize.GEOMETRY('POLYGON', 4326),
        allowNull: false,
      },
    },
    {
      tableName: 'SlicedWeathers',
      timestamps: false,
    },
  );

  return slicedWeather;
};
