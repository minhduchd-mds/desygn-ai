/**
 * commandBus — Command pattern with undo/redo stack.
 *
 * Every reversible user action (edit Design.md, swap template, clear chat)
 * is wrapped in a Command object. The bus executes it, pushes to the undo
 * stack, and clears redo. Ctrl+Z / Ctrl+Y replay history.
 *
 * Usage:
 *   await commandBus.execute(new SetDesignMdCommand(prev, next, setDesignMd));
 *   await commandBus.undo();   // "Set Design.md" reversed
 *   await commandBus.redo();
 */

// ── Command interface ─────────────────────────────────────────

export interface Command<T = void> {
  /** Human-readable label shown in undo/redo UI hints. */
  readonly description: string;
  /** Perform the action. May return a result. */
  execute(): T | Promise<T>;
  /** Revert the action to its previous state. */
  undo(): void | Promise<void>;
}

// ── Bus ───────────────────────────────────────────────────────

export class CommandBus {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private readonly _maxHistory: number;

  constructor(maxHistory = 50) {
    this._maxHistory = maxHistory;
  }

  /**
   * Execute a command, push it to the undo stack, and clear redo.
   * Returns whatever `command.execute()` returns.
   */
  async execute<T>(command: Command<T>): Promise<T> {
    const result = await command.execute();
    this.undoStack.push(command as Command);
    if (this.undoStack.length > this._maxHistory) this.undoStack.shift();
    this.redoStack.length = 0; // new action always clears redo
    return result;
  }

  /**
   * Undo the last command.
   * Returns the description of what was undone, or null if nothing to undo.
   */
  async undo(): Promise<string | null> {
    const command = this.undoStack.pop();
    if (!command) return null;
    await command.undo();
    this.redoStack.push(command);
    return command.description;
  }

  /**
   * Redo the last undone command.
   * Returns the description of what was redone, or null if nothing to redo.
   */
  async redo(): Promise<string | null> {
    const command = this.redoStack.pop();
    if (!command) return null;
    await command.execute();
    this.undoStack.push(command);
    return command.description;
  }

  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get undoCount(): number { return this.undoStack.length; }
  get redoCount(): number { return this.redoStack.length; }

  /** What would Ctrl+Z undo? (null if stack is empty) */
  peekUndo(): string | null { return this.undoStack.at(-1)?.description ?? null; }
  /** What would Ctrl+Y redo? (null if stack is empty) */
  peekRedo(): string | null { return this.redoStack.at(-1)?.description ?? null; }

  /** Clear both stacks (e.g. on project switch). */
  clear(): void {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
  }
}

export const commandBus = new CommandBus();

// ── Built-in generic commands ─────────────────────────────────

/**
 * Wraps any simple setter (useState dispatcher, localStorage write, etc.)
 * into an undoable command.
 *
 * @example
 * await commandBus.execute(
 *   makeSetCommand("Edit Design.md", () => designMd, setDesignMd, newContent)
 * );
 */
export function makeSetCommand<T>(
  description: string,
  getter: () => T,
  setter: (v: T) => void,
  newValue: T,
): Command {
  let prev: T;
  return {
    description,
    execute() { prev = getter(); setter(newValue); },
    undo() { setter(prev); },
  };
}

/**
 * Groups multiple commands into a single undoable unit.
 */
export function makeBatchCommand(description: string, commands: Command[]): Command {
  return {
    description,
    async execute() {
      for (const cmd of commands) await cmd.execute();
    },
    async undo() {
      for (const cmd of [...commands].reverse()) await cmd.undo();
    },
  };
}
