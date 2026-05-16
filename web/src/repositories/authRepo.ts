/**
 * authRepo — repository wrapping the auth module.
 *
 * The UI layer only imports authRepo, never auth.ts directly.
 * This lets us swap the backend (localStorage → Supabase Auth → NextAuth)
 * without touching a single component.
 *
 * Side-effects:
 *  • Emits session events to eventBus
 *  • Emits error events to errorBus
 */

import {
  register as authRegister,
  login as authLogin,
  getSessionUser,
  saveSessionUser,
  clearSessionUser,
  updatePlan,
  getProjectHistory,
  saveProjectHistory,
} from "../app/auth";
import type { AccountPlan, ProjectHistoryItem, SessionUser } from "../app/types";
import { errorBus } from "../lib/errorBus";
import { eventBus } from "../lib/eventBus";

export const authRepo = {
  // ── Auth ────────────────────────────────────────────────────

  async register(email: string, password: string): Promise<SessionUser> {
    try {
      const user = await authRegister(email, password);
      saveSessionUser(user);
      eventBus.emit("session:started", { emailHash: user.emailHash, plan: user.plan });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      errorBus.auth(message);
      throw err;
    }
  },

  async login(email: string, password: string): Promise<SessionUser> {
    try {
      const user = await authLogin(email, password);
      saveSessionUser(user);
      eventBus.emit("session:started", { emailHash: user.emailHash, plan: user.plan });
      return user;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Login failed";
      errorBus.auth(message);
      throw err;
    }
  },

  // ── Session ──────────────────────────────────────────────────

  /** Returns current session, or null if missing / expired. */
  getSession(): SessionUser | null {
    const user = getSessionUser();
    if (!user) return null;
    if (user.expiresAt <= Date.now()) {
      clearSessionUser();
      eventBus.emit("session:expired");
      return null;
    }
    return user;
  },

  logout(): void {
    clearSessionUser();
    eventBus.emit("session:expired");
  },

  // ── Plan ─────────────────────────────────────────────────────

  upgradePlan(emailHash: string, plan: AccountPlan): void {
    updatePlan(emailHash, plan);
    eventBus.emit("session:plan:upgraded", { plan });
  },

  // ── Project history ──────────────────────────────────────────

  getProjectHistory(): ProjectHistoryItem[] {
    return getProjectHistory();
  },

  saveProjectHistory(items: ProjectHistoryItem[]): void {
    saveProjectHistory(items);
  },
};
