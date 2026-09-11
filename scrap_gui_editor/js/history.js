export class History {
  constructor(limit = 250) {
    this.limit = limit;
    this.undoStack = [];
    this.redoStack = [];
    this.onChange = null;
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  get undoLabel() {
    return this.undoStack.length ? this.undoStack[this.undoStack.length - 1].label : "";
  }

  get redoLabel() {
    return this.redoStack.length ? this.redoStack[this.redoStack.length - 1].label : "";
  }

  push(command) {
    if (!command || typeof command.undo !== "function" || typeof command.redo !== "function") return;
    this.undoStack.push(command);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = [];
    this.notify();
  }

  execute(command) {
    command.redo();
    this.push(command);
  }

  undo() {
    if (!this.canUndo) return null;
    const cmd = this.undoStack.pop();
    cmd.undo();
    this.redoStack.push(cmd);
    this.notify();
    return cmd;
  }

  redo() {
    if (!this.canRedo) return null;
    const cmd = this.redoStack.pop();
    cmd.redo();
    this.undoStack.push(cmd);
    this.notify();
    return cmd;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  notify() {
    if (this.onChange) this.onChange();
  }
}

export function snapshotGeometry(widgets) {
  return widgets.map((w) => ({
    id: w.id,
    x: w.x,
    y: w.y,
    w: w.w,
    h: w.h,
  }));
}

export function restoreGeometry(byId, snaps) {
  for (const s of snaps) {
    const w = byId.get(s.id);
    if (!w) continue;
    w.x = s.x;
    w.y = s.y;
    w.w = s.w;
    w.h = s.h;
  }
}
