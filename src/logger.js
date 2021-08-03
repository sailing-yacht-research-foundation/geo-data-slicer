const winston = require('winston');
const path = require('path');
const { createLogger, format, transports } = winston;
const { combine, timestamp, printf, colorize } = format;

const logFormat = printf(({ level, message, service, timestamp }) => {
  return `${timestamp} [${service}] ${level}: ${message}`;
});
const logFolder = path.resolve(__dirname, '../logs');

winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'blue',
});

const logger = createLogger({
  level: 'info',
  format: combine(timestamp(), logFormat),
  defaultMeta: { service: 'geo-data-slicer' },
  exceptionHandlers: [
    new transports.File({ filename: `${logFolder}/exceptions.log` }),
  ],
});

if (process.env.NODE_ENV !== 'test') {
  logger.add(
    new transports.File({
      filename: `${logFolder}/error.log`,
      level: 'error',
    }),
  );
  logger.add(new transports.File({ filename: `${logFolder}/combined.log` }));

  if (process.env.NODE_ENV !== 'production') {
    logger.add(
      new transports.Console({
        format: combine(colorize({ all: true }), timestamp(), logFormat),
      }),
    );
  }
}

module.exports = logger;
