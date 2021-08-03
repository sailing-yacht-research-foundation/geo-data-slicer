module.exports = (sequelize, Sequelize) => {
  const weatherData = sequelize.define(
    'WeatherDatas',
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
      original_file_name: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      grib_file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    },
    {
      tableName: 'WeatherDatas',
      timestamps: false,
      indexes: [
        {
          unique: false,
          fields: ['start_time'],
        },
        {
          unique: false,
          fields: ['end_time'],
        },
      ],
    },
  );

  return weatherData;
};
