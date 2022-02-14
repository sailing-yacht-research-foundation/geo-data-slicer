const IORedis = require('ioredis');
const logger = require('../logger');

const recalculateQueue = require('./recalculateQueue');

let opt = {
  host: process.env.REDIS_HOST,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

const connect = () => {
  return new Promise((resolve, reject) => {
    const connection = new IORedis(opt);

    const timeout = setTimeout(() => {
      logger.info(
        'Redis connection is taking too long, skip waiting for redis connection',
      );
      resolve();
    }, 5000);

    connection.ping((err) => {
      if (err) {
        logger.error('Redis connection failed: ', err);
        reject(err);
      }

      logger.info(
        `Redis connection established: ${process.env.REDIS_HOST}:${opt.port}`,
      );
      clearTimeout(timeout);
      recalculateQueue.setup(connection);

      resolve();
    });
  });
};

module.exports = {
  connect,
};
