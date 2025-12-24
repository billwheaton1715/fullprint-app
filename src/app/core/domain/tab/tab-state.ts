import { TabDocument } from './tab-document';

export class TabState {
  readonly id: string;
  readonly document: TabDocument;

  constructor(document: TabDocument) {
    this.id = document.id;
    this.document = document;
  }
}
