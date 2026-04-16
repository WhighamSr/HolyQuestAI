/**
 * jest.config.js
 * Jest configuration for Holy Quest AI VS Code Extension.
 * Uses ts-jest for TypeScript support.
 * Tests run in Node environment (not browser/jsdom).
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/test'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  moduleNameMapper: {
    // Mock VS Code API — it is not available in Jest environment
    'vscode': '<rootDir>/src/test/setup.ts',
  },
  collectCoverageFrom: [
    'src/utils/**/*.ts',
    'src/privacy/**/*.ts',
    'src/workspace/**/*.ts',
    '!src/**/*.test.ts',
    '!src/test/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  coverageReporters: ['text', 'lcov'],
  verbose: true,
};
