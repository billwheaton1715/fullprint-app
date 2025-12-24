import { TabState } from '../../domain/tab/tab-state';
import { TabDocument } from '../../domain/tab/tab-document';

export class TabManager {
  private tabs = new Map<string, TabState>();
  private activeTabId: string | null = null;

  createTab(document: TabDocument): TabState {
    const tab = new TabState(document);
    this.tabs.set(tab.id, tab);
    this.activeTabId = tab.id;
    return tab;
  }

  closeTab(tabId: string): void {
    this.tabs.delete(tabId);

    if (this.activeTabId === tabId) {
      this.activeTabId = this.tabs.size
        ? Array.from(this.tabs.keys())[0]
        : null;
    }
  }

  getActiveTab(): TabState | null {
    if (!this.activeTabId) return null;
    return this.tabs.get(this.activeTabId) ?? null;
  }

  setActiveTab(tabId: string): void {
    if (this.tabs.has(tabId)) {
      this.activeTabId = tabId;
    }
  }

  getAllTabs(): TabState[] {
    return Array.from(this.tabs.values());
  }
}
