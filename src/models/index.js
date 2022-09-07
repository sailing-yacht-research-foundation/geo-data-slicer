const Sequelize = require('sequelize');

const DB_HOST = process.env.WEATHER_DB_HOST;
const DB_PORT = process.env.WEATHER_DB_PORT;
const DB_NAME = process.env.WEATHER_DB_NAME;
const DB_USER = process.env.WEATHER_DB_USER;
const DB_PASSWORD = process.env.WEATHER_DB_PASSWORD;

if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER || !DB_PASSWORD) {
  console.error('Invalid database credentials!');
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
});

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.sourceModel = require('./sourceModel.model.js')(sequelize, Sequelize);
db.weatherData = require('./weatherData.model.js')(sequelize, Sequelize);
db.skippedCompetition = require('./skippedCompetition.model')(
  sequelize,
  Sequelize,
);

db.startDB = async () => {
  await sequelize.authenticate();
  console.log('Weather DB connected');
};

module.exports = db;
