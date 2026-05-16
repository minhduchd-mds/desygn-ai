/**
 * authRepo — unit tests
 * Focus: login/register side effects (eventBus, errorBus), session management.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { eventBus } from "../../lib/eventBus";
import { errorBus } from "../../lib/errorBus";

// ── Mock the auth module ───────────────────────────────────────

vi.mock("../../app/auth", () => ({
  register: vi.fn(),
  login: vi.fn(),
  getSessionUser: vi.fn(),
  saveSessionUser: vi.fn(),
  clearSessionUser: vi.fn(),
  updatePlan: vi.fn(),
  getProjectHistory: vi.fn(() => []),
  saveProjectHistory: vi.fn(),
}));

import * as authMod from "../../app/auth";
import { authRepo } from "../authRepo";

const mockRegister = vi.mocked(authMod.register);
const mockLogin = vi.mocked(authMod.login);
const mockGetSession = vi.mocked(authMod.getSessionUser);
const mockSaveSession = vi.mocked(authMod.saveSessionUser);
const mockClearSession = vi.mocked(authMod.clearSessionUser);
const mockUpdatePlan = vi.mocked(authMod.updatePlan);

const FAKE_USER = {
  emailHash: "hash123",
  displayEmail: "user@example.com",
  plan: "free" as const,
  expiresAt: Date.now() + 1_000_000,
};

beforeEach(() => {
  vi.clearAllMocks();
  eventBus.clear();
  errorBus.clear();
});

afterEach(() => {
  eventBus.clear();
  errorBus.clear();
});

describe("authRepo", () => {

  describe("register()", () => {
    it("calls authRegister and saves session on success", async () => {
      mockRegister.mockResolvedValue(FAKE_USER);
      await authRepo.register("user@example.com", "StrongPass1!");
      expect(mockRegister).toHaveBeenCalledWith("user@example.com", "StrongPass1!");
      expect(mockSaveSession).toHaveBeenCalledWith(FAKE_USER);
    });

    it("emits session:started on success", async () => {
      mockRegister.mockResolvedValue(FAKE_USER);
      const handler = vi.fn();
      eventBus.on("session:started", handler);
      await authRepo.register("user@example.com", "StrongPass1!");
      expect(handler).toHaveBeenCalledWith({ emailHash: "hash123", plan: "free" });
    });

    it("emits AUTH_ERROR to errorBus on failure", async () => {
      mockRegister.mockRejectedValue(new Error("This account already exists."));
      const handler = vi.fn();
      errorBus.subscribe(handler);
      await expect(authRepo.register("x@x.com", "pass")).rejects.toThrow();
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTH_ERROR" }));
    });

    it("re-throws the original error", async () => {
      const err = new Error("Email already taken");
      mockRegister.mockRejectedValue(err);
      await expect(authRepo.register("x@x.com", "p")).rejects.toBe(err);
    });
  });

  describe("login()", () => {
    it("calls authLogin and saves session on success", async () => {
      mockLogin.mockResolvedValue(FAKE_USER);
      await authRepo.login("user@example.com", "MyPass123!");
      expect(mockSaveSession).toHaveBeenCalledWith(FAKE_USER);
    });

    it("emits session:started on success", async () => {
      mockLogin.mockResolvedValue(FAKE_USER);
      const handler = vi.fn();
      eventBus.on("session:started", handler);
      await authRepo.login("user@example.com", "MyPass123!");
      expect(handler).toHaveBeenCalledOnce();
    });

    it("emits AUTH_ERROR on login failure", async () => {
      mockLogin.mockRejectedValue(new Error("Wrong password"));
      const handler = vi.fn();
      errorBus.subscribe(handler);
      await authRepo.login("x@x.com", "wrong").catch(() => {});
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({ code: "AUTH_ERROR" }));
    });
  });

  describe("getSession()", () => {
    it("returns user when session is valid and not expired", () => {
      mockGetSession.mockReturnValue(FAKE_USER);
      const result = authRepo.getSession();
      expect(result).toEqual(FAKE_USER);
    });

    it("returns null when getSessionUser returns null", () => {
      mockGetSession.mockReturnValue(null);
      expect(authRepo.getSession()).toBeNull();
    });

    it("returns null and emits session:expired when session is expired", () => {
      const expired = { ...FAKE_USER, expiresAt: Date.now() - 1 };
      mockGetSession.mockReturnValue(expired);
      const handler = vi.fn();
      eventBus.on("session:expired", handler);
      const result = authRepo.getSession();
      expect(result).toBeNull();
      expect(mockClearSession).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("logout()", () => {
    it("clears session and emits session:expired", () => {
      const handler = vi.fn();
      eventBus.on("session:expired", handler);
      authRepo.logout();
      expect(mockClearSession).toHaveBeenCalled();
      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe("upgradePlan()", () => {
    it("calls updatePlan and emits session:plan:upgraded", () => {
      const handler = vi.fn();
      eventBus.on("session:plan:upgraded", handler);
      authRepo.upgradePlan("hash123", "pro");
      expect(mockUpdatePlan).toHaveBeenCalledWith("hash123", "pro");
      expect(handler).toHaveBeenCalledWith({ plan: "pro" });
    });
  });

  describe("project history", () => {
    it("getProjectHistory delegates to auth module", () => {
      const history = [{ name: "App", date: "today", prompt: "x", category: "SaaS", openDesign: "linear", target: "React" }];
      vi.mocked(authMod.getProjectHistory).mockReturnValue(history);
      expect(authRepo.getProjectHistory()).toBe(history);
    });

    it("saveProjectHistory delegates to auth module", () => {
      const items = [{ name: "App", date: "today", prompt: "x", category: "SaaS", openDesign: "linear", target: "React" }];
      authRepo.saveProjectHistory(items);
      expect(vi.mocked(authMod.saveProjectHistory)).toHaveBeenCalledWith(items);
    });
  });
});
