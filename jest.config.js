process.env.NODE_ENV = 'test';

module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    'node_modules',
    '<rootDir>/src/models',
    '<rootDir>/src/logger.js',
    '<rootDir>/src/syrf-schema',
    '<rootDir>/src/configs',
  ],
  setupFiles: ['dotenv/config'],
  modulePathIgnorePatterns: ['<rootDir>/src/syrf-schema'],
};
