module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    "./examples/",
    "./node_modules/",
  ],
};
