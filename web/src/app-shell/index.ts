/**
 * app-shell/ — Application shell & layout orchestration.
 *
 * Responsibilities:
 *   • Top-level layout (sidebar, header, main content, toasts)
 *   • Route/view switching (landing ↔ workspace ↔ auth)
 *   • Theme management (dark/light)
 *   • Error boundaries
 *   • Toast notification system
 *   • Keyboard shortcuts registration
 *   • Online/offline detection
 *   • EventBus → UI reaction wiring
 *
 * This module provides the structural shell — content is rendered
 * by workspace-store + chat-engine + design-engine + auth.
 */

import { eventBus } from "../lib/eventBus";
import { errorBus } from "../lib/errorBus";
import { watchOnline } from "../lib/offlineQueue";

// ── Types ──────────────────────────────────────────────────────

export interface ToastItem {
  id: number;
  msg: string;
  type: "success" | "error" | "warn" | "info";
}

export interface AppShellConfig {
  productName: string;
  repositoryUrl: string;
  maxToasts: number;
  toastDurationMs: number;
}

// ── Default Config ─────────────────────────────────────────────

export const APP_SHELL_CONFIG: AppShellConfig = {
  productName: "Desygn AI",
  repositoryUrl: "https://github.com/minhduchd-mds/desygn-ai",
  maxToasts: 5,
  toastDurationMs: 3500,
};

// ── Toast Manager ──────────────────────────────────────────────

export class ToastManager {
  private toasts: ToastItem[] = [];
  private nextId = 0;
  private listeners: Set<(toasts: ToastItem[]) => void> = new Set();

  show(msg: string, type: ToastItem["type"] = "success"): number {
    const id = ++this.nextId;
    this.toasts = [...this.toasts.slice(-(APP_SHELL_CONFIG.maxToasts - 1)), { id, msg, type }];
    this.notify();

    setTimeout(() => this.dismiss(id), APP_SHELL_CONFIG.toastDurationMs);
    return id;
  }

  dismiss(id: number): void {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }

  getAll(): readonly ToastItem[] {
    return this.toasts;
  }

  subscribe(listener: (toasts: ToastItem[]) => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener([...this.toasts]);
    }
  }
}

export const toastManager = new ToastManager();

// ── EventBus Wiring ────────────────────────────────────────────

/**
 * Wire up all EventBus → app-shell reactions.
 * Call once at app startup, returns cleanup function.
 */
export function initAppShellEvents(): () => void {
  const unsubs: Array<() => void> = [];

  // Toast events from any module
  unsubs.push(eventBus.on("toast:show", ({ message, type }) => {
    toastManager.show(message, type);
  }));

  // Offline queue flush
  unsubs.push(eventBus.on("offline:flushed", ({ success, failed }) => {
    if (success > 0) toastManager.show(`Sent ${success} offline requests`, "success");
    if (failed > 0) toastManager.show(`${failed} requests still failed`, "warn");
  }));

  // Error bus → toast for fatal errors
  unsubs.push(errorBus.subscribe((err) => {
    if (err.severity === "fatal") toastManager.show(`Fatal: ${err.message}`, "error");
  }));

  // Online/offline watcher
  const unwatchOnline = watchOnline();

  return () => {
    for (const unsub of unsubs) unsub();
    unwatchOnline();
  };
}

// ── Theme Manager ──────────────────────────────────────────────

export function applyTheme(theme: "dark" | "light"): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("desygn.theme", theme);
}

export function getInitialTheme(): "dark" | "light" {
  const saved = localStorage.getItem("desygn.theme");
  return saved === "light" ? "light" : "dark";
}

// ── Constants ──────────────────────────────────────────────────

export const PRODUCT_NAME = APP_SHELL_CONFIG.productName;
export const REPOSITORY_URL = APP_SHELL_CONFIG.repositoryUrl;
