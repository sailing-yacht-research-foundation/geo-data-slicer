module.exports = (sequelize, Sequelize) => {
  const sourceModel = sequelize.define(
    "SourceModels",
    {
      model_name: {
        type: Sequelize.TEXT,
        allowNull: false,
        primaryKey: true,
      },
      file_format: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      csv_order: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      spatial_resolution: {
        type: Sequelize.DOUBLE,
        allowNull: false,
      },
      spatial_resolution_units: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      release_times_utc: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
      },
      available_times_utc: {
        type: Sequelize.ARRAY(Sequelize.TEXT),
        allowNull: false,
      },
      timestep_resolution: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      timestep_beginning: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      timestep_miliseconds: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      timestep_padding: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      max_timesteps: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      file_list: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      help_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      spatial_boundary: {
        type: Sequelize.GEOMETRY("POLYGON", 4326),
        allowNull: true,
      },
    },
    {
      tableName: "SourceModels",
      timestamps: false,
    }
  );

  return sourceModel;
};
