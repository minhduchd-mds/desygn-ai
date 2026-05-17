/**
 * auth/ — Authentication & session management module.
 *
 * Consolidates all auth logic from app/auth.ts + main.tsx auth state.
 * Provides a clean API for session lifecycle, plan management, and
 * encryption-backed local auth (demo mode).
 *
 * Production path: Replace localAuth with SSO/OAuth provider.
 */

export { register, login, updatePlan, getSessionUser, saveSessionUser, clearSessionUser, SESSION_TTL_MS } from "../app/auth";
export { getProjectHistory, saveProjectHistory, getChatHistoryKey, encryptChatMessages, decryptChatMessages, createMessage } from "../app/auth";
export type { SessionUser, AuthMode } from "../app/types";

import { getSessionUser, saveSessionUser, clearSessionUser } from "../app/auth";
import type { SessionUser } from "../app/types";
import { eventBus } from "../lib/eventBus";
import { workspaceStore } from "../workspace-store";

// ── Session Controller ────────────────────────────────────────

export class SessionController {
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /** Initialize session from localStorage, start TTL watchdog */
  init(): SessionUser | null {
    const user = getSessionUser();
    if (user) {
      saveSessionUser(user); // Refresh TTL
      this.startWatchdog();
    }
    return user;
  }

  /** Called after successful login/register */
  onLogin(user: SessionUser): void {
    saveSessionUser(user);
    workspaceStore.setState({ view: "workspace" });
    this.startWatchdog();
  }

  /** Logout and clean up */
  logout(): void {
    clearSessionUser();
    this.stopWatchdog();
    workspaceStore.setState({ view: "landing" });
    eventBus.emit("toast:show", { message: "Logged out", type: "info" });
  }

  /** Check if session is still valid */
  isValid(): boolean {
    return getSessionUser() !== null;
  }

  private startWatchdog(): void {
    this.stopWatchdog();
    this.checkInterval = setInterval(() => {
      if (!getSessionUser()) {
        this.stopWatchdog();
        eventBus.emit("session:expired", undefined);
      }
    }, 60_000); // Check every minute
  }

  private stopWatchdog(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  destroy(): void {
    this.stopWatchdog();
  }
}

export const sessionController = new SessionController();
