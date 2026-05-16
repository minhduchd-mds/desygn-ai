/**
 * errorBus — global error event system.
 *
 * Any layer (API, auth, supabase, workers) emits here.
 * UI subscribes once and shows toasts / logs / Sentry.
 *
 * Design goals:
 *  - Zero dependencies
 *  - Handler errors are isolated (never crash caller)
 *  - Unsubscribe returned from subscribe()
 */

export type ErrorSeverity = "info" | "warn" | "error" | "fatal";

export interface AppError {
  /** Machine-readable identifier. */
  code: string;
  /** Human-readable message. */
  message: string;
  severity: ErrorSeverity;
  /** Whether the caller may safely retry. */
  retryable: boolean;
  /** Arbitrary extra context for debugging. */
  context?: Record<string, unknown>;
  timestamp: number;
}

type ErrorHandler = (err: AppError) => void;

class ErrorBus {
  private readonly handlers = new Set<ErrorHandler>();

  /** Subscribe to all errors. Returns an unsubscribe function. */
  subscribe(handler: ErrorHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Emit a full error object (timestamp added automatically). */
  emit(err: Omit<AppError, "timestamp">): void {
    const full: AppError = { ...err, timestamp: Date.now() };
    for (const handler of this.handlers) {
      try {
        handler(full);
      } catch {
        /* isolate handler errors so one bad subscriber doesn't break others */
      }
    }
  }

  // ── Convenience emitters ─────────────────────────────────────

  network(message: string, retryable = true): void {
    this.emit({ code: "NETWORK_ERROR", message, severity: "error", retryable });
  }

  auth(message: string): void {
    this.emit({ code: "AUTH_ERROR", message, severity: "error", retryable: false });
  }

  warn(code: string, message: string, context?: Record<string, unknown>): void {
    this.emit({ code, message, severity: "warn", retryable: false, context });
  }

  fatal(code: string, message: string, context?: Record<string, unknown>): void {
    this.emit({ code, message, severity: "fatal", retryable: false, context });
  }

  /** Remove all subscribers (useful in tests). */
  clear(): void {
    this.handlers.clear();
  }

  get subscriberCount(): number {
    return this.handlers.size;
  }
}

export const errorBus = new ErrorBus();
