/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '\.svg$': '<rootDir>/__mocks__/svg.js'
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/cypress/'],
  testTimeout: 30000,
  transform: {
    '^.+\.(ts|tsx)$': ['ts-jest', {
      tsconfig: { jsx: 'react-jsx' }
    }]
  },
};
