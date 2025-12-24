import { Routes } from '@angular/router';
import { importProvidersFrom } from '@angular/core';
import { CanvasTabComponent } from './ui/canvas/canvas-tab.component';

export const routes: Routes = [
	{ path: '', component: CanvasTabComponent },
];
