
import type { Config } from 'jest';

const config: Config = {
  projects: [
    {
      displayName: 'angular',
      preset: 'jest-preset-angular',
      setupFiles: ['<rootDir>/src/test/jest-setup.ts'],
      testMatch: ['**/?(*.)+(spec).ts', '!**/*.plain.spec.ts'],
      testEnvironment: 'jsdom',
      transformIgnorePatterns: [
        'node_modules/(?!.*\\.mjs$)',
      ],
    },
    {
      displayName: 'plain',
      setupFiles: ['<rootDir>/setup-jest-plain.ts'],
      testMatch: ['**/?(*.)+(plain.spec).ts'],
      transform: {
        '^.+\\.tsx?$': 'ts-jest',
      },
      testEnvironment: 'jsdom',
      transformIgnorePatterns: [
        'node_modules/(?!.*\\.mjs$)',
      ],
    },
  ],
};

export default config;
