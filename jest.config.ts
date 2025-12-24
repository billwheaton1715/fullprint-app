import type { Config } from 'jest';

const config: Config = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/setup-jest.ts'],
  testMatch: ['**/?(*.)+(spec).ts'],
  testEnvironment: 'jsdom',

  // IMPORTANT: let jest-preset-angular control transforms
  transformIgnorePatterns: [
    'node_modules/(?!.*\\.mjs$)',
  ],
};

export default config;
