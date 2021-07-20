process.env.NODE_ENV = 'test';

module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['node_modules', '<rootDir>/src/models'],
  setupFiles: ['dotenv/config'],
};
