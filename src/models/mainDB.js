const Sequelize = require('sequelize');

const DB_HOST = process.env.MAIN_DB_HOST;
const DB_PORT = process.env.MAIN_DB_PORT;
const DB_NAME = process.env.MAIN_DB_NAME;
const DB_USER = process.env.MAIN_DB_USER;
const DB_PASSWORD = process.env.MAIN_DB_PASSWORD;

if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER || !DB_PASSWORD) {
  console.error('Invalid main database credentials!');
}

const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
  host: DB_HOST,
  port: DB_PORT,
  dialect: 'postgres',
  logging: false,
  retry: {
    max: 10,
    match: [
      /ConnectionError/,
      /SequelizeConnectionError/,
      /SequelizeConnectionRefusedError/,
      /SequelizeHostNotFoundError/,
      /SequelizeHostNotReachableError/,
      /SequelizeInvalidConnectionError/,
      /SequelizeConnectionTimedOutError/,
      /SequelizeConnectionAcquireTimeoutError/,
      /Connection terminated unexpectedly/,
    ],
  },
});

const mainDB = {};

mainDB.Sequelize = Sequelize;
mainDB.sequelize = sequelize;

mainDB.slicedWeather = require('./slicedWeather.model.js')(
  sequelize,
  Sequelize,
);

module.exports = mainDB;
