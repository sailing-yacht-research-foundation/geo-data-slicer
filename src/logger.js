const { createLogger, format, transports } = require('winston');
const path = require('path');
const { combine, timestamp, printf } = format;

const logFormat = printf(({ level, message, service, timestamp }) => {
  return `${timestamp} [${service}] ${level}: ${message}`;
});
const logFolder = path.resolve(__dirname, '../logs');
const logger = createLogger({
  level: 'info',
  format: combine(timestamp(), logFormat),
  defaultMeta: { service: 'geo-data-slicer' },
  transports: [
    new transports.File({
      filename: `${logFolder}/error.log`,
      level: 'error',
    }),
    new transports.File({ filename: `${logFolder}/combined.log` }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new transports.Console({
      format: combine(timestamp(), logFormat),
    }),
  );
}

module.exports = logger;
