

export interface CanvasCommand {
  execute(): boolean; // true => something changed
}
