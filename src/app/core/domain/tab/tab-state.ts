import { TabDocument } from './tab-document';
import { CommandManager } from '../../application/services/command-manager';

export class TabState {
  readonly id: string;
  readonly document: TabDocument;
  readonly commands: CommandManager;

  constructor(document: TabDocument) {
    this.id = document.id;
    this.document = document;
    this.commands = new CommandManager();
  }
}
