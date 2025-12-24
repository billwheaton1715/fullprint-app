import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { DPI } from './app/core/units/dpi.token';
import Measurement from './app/core/units/Measurement';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    { provide: DPI, useValue: 96 },
    {
      provide: APP_INITIALIZER,
      useFactory: (dpi: number) => {
        return () => {
          Measurement.setDpiProvider(() => dpi);
        };
      },
      deps: [DPI],
      multi: true,
    },
  ],
};
