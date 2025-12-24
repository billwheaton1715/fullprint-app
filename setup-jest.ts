// setup-jest.ts
// Provides Zone.js environment and initializes Angular's TestBed for Jest
import 'jest-preset-angular/setup-env/zone';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';

// Initialize the Angular testing environment (TestBed) for Jest runs.
// This is required when running tests without Karma/Angular CLI.
getTestBed().initTestEnvironment(
	BrowserDynamicTestingModule,
	platformBrowserDynamicTesting()
);
