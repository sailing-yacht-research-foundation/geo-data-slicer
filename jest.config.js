process.env.NODE_ENV = 'test';

module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: [
    'node_modules',
    '<rootDir>/src/models',
    '<rootDir>/src/logger.js',
  ],
  setupFiles: ['dotenv/config'],
};
