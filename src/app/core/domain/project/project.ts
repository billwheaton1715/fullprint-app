import { TabDocument } from '../tab/tab-document';

export interface Project {
  id: string;
  title: string;
  tabs: TabDocument[];
  activeTabId: string | null;
}
