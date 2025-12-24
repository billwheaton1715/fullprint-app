import { Command } from '../../domain/commands/command';

export class CommandManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (!command) return;

    command.undo();
    this.redoStack.push(command);
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (!command) return;

    command.execute();
    this.undoStack.push(command);
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
