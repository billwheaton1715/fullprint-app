import { Project } from '../../domain/project/project';

export interface AppState {
  project: Project | null;
}
