/**
 * VYENFITA Jest Configuration
 * 
 * @version 1.0.1
 */

/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts',
  ],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          skipLibCheck: true,
          strict: false,
          noImplicitAny: false,
          strictNullChecks: false,
          resolveJsonModule: true,
        },
        diagnostics: false,
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
    '!src/**/interfaces/**',
    '!src/**/schemas/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  coverageThresholds: undefined,
  testTimeout: 30000,
  verbose: false,
  forceExit: true,
  detectOpenHandles: true,
  maxWorkers: 1,
  bail: false,
  errorOnDeprecated: false,
};
