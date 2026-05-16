/**
 * eventBus — typed publish/subscribe event system.
 *
 * Replaces prop drilling chains for cross-component / cross-module communication.
 * Every domain event is declared in EventMap for full TypeScript safety.
 *
 * Usage:
 *   const off = eventBus.on("toast:show", ({ message }) => showToast(message));
 *   eventBus.emit("toast:show", { message: "Saved!", type: "success" });
 *   off(); // unsubscribe
 */

// ── Event catalogue ───────────────────────────────────────────
// Add new events here — TypeScript enforces payload shapes everywhere.

export type ToastType = "success" | "error" | "warn" | "info";

export interface EventMap {
  // Projects
  "project:created": { name: string; category: string; template: string };
  "project:updated": { name: string };
  "project:deleted": { name: string };

  // Design
  "design:generated": { projectName: string; template: string; durationMs: number };
  "design:md:changed": { content: string };

  // Figma MCP
  "figma:connected": { endpoint: string };
  "figma:disconnected": void;
  "figma:error": { message: string };

  // Auth / Session
  "session:started": { emailHash: string; plan: string };
  "session:expired": void;
  "session:plan:upgraded": { plan: string };

  // UI
  "toast:show": { message: string; type: ToastType };
  "chat:cleared": void;
  "tab:changed": { tab: string };

  // Network
  "offline:queued": { requestId: string; url: string };
  "offline:flushed": { success: number; failed: number };
  "online:restored": void;
}

export type EventKey = keyof EventMap;

// Derive the correct handler signature per event (void payload = no arg)
type EventHandler<K extends EventKey> = EventMap[K] extends void
  ? () => void
  : (payload: EventMap[K]) => void;

// ── Bus implementation ────────────────────────────────────────

class EventBus {
  private readonly listeners = new Map<EventKey, Set<(...args: unknown[]) => void>>();

  /**
   * Subscribe to an event. Returns an unsubscribe function.
   */
  on<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const fn = handler as (...args: unknown[]) => void;
    this.listeners.get(event)!.add(fn);
    return () => this.listeners.get(event)?.delete(fn);
  }

  /**
   * Subscribe to the NEXT occurrence only, then auto-unsubscribe.
   */
  once<K extends EventKey>(event: K, handler: EventHandler<K>): () => void {
    let unsubscribe: (() => void) | undefined;
    const wrapper = ((...args: unknown[]) => {
      unsubscribe?.();
      (handler as (...a: unknown[]) => void)(...args);
    }) as EventHandler<K>;
    unsubscribe = this.on(event, wrapper);
    return unsubscribe;
  }

  /** Manually unsubscribe a specific handler. */
  off<K extends EventKey>(event: K, handler: EventHandler<K>): void {
    this.listeners.get(event)?.delete(handler as (...args: unknown[]) => void);
  }

  /**
   * Emit an event. Payload is required unless the event type is `void`.
   * Handler errors are caught and logged so one bad handler never blocks others.
   */
  emit<K extends EventKey>(
    event: K,
    ...args: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers?.size) return;

    for (const handler of handlers) {
      try {
        handler(...(args as unknown[]));
      } catch (err) {
        console.error(`[EventBus] Handler threw for "${event}":`, err);
      }
    }
  }

  /** Number of active listeners for a given event (useful in tests). */
  listenerCount(event: EventKey): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  /** Remove ALL listeners for all events (use in tests only). */
  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();
