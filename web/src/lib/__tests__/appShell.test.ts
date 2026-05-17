/**
 * Tests for app-shell module.
 */
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { ToastManager, APP_SHELL_CONFIG, getInitialTheme, PRODUCT_NAME, REPOSITORY_URL } from "../../app-shell";

describe("ToastManager", () => {
  let manager: ToastManager;

  beforeEach(() => {
    manager = new ToastManager();
  });

  it("shows toast and returns id", () => {
    const id = manager.show("Test message");
    expect(id).toBeGreaterThan(0);
    expect(manager.getAll().length).toBe(1);
    expect(manager.getAll()[0].msg).toBe("Test message");
  });

  it("shows toast with type", () => {
    manager.show("Error!", "error");
    expect(manager.getAll()[0].type).toBe("error");
  });

  it("dismisses toast by id", () => {
    const id = manager.show("Temp");
    manager.dismiss(id);
    expect(manager.getAll().length).toBe(0);
  });

  it("limits to maxToasts", () => {
    for (let i = 0; i < 10; i++) {
      manager.show(`Toast ${i}`);
    }
    expect(manager.getAll().length).toBeLessThanOrEqual(APP_SHELL_CONFIG.maxToasts);
  });

  it("notifies subscribers on show", () => {
    const received: number[] = [];
    manager.subscribe(toasts => received.push(toasts.length));
    manager.show("hello");
    expect(received).toContain(1);
  });

  it("notifies subscribers on dismiss", () => {
    const received: number[] = [];
    const id = manager.show("hello");
    manager.subscribe(toasts => received.push(toasts.length));
    manager.dismiss(id);
    expect(received).toContain(0);
  });

  it("unsubscribe stops notifications", () => {
    let count = 0;
    const unsub = manager.subscribe(() => { count++; });
    manager.show("a");
    unsub();
    manager.show("b");
    expect(count).toBe(1);
  });
});

describe("APP_SHELL_CONFIG", () => {
  it("has correct product name", () => {
    expect(APP_SHELL_CONFIG.productName).toBe("Desygn AI");
  });

  it("has correct repository URL", () => {
    expect(APP_SHELL_CONFIG.repositoryUrl).toContain("Design-md-ai");
  });

  it("has reasonable toast duration", () => {
    expect(APP_SHELL_CONFIG.toastDurationMs).toBeGreaterThan(1000);
    expect(APP_SHELL_CONFIG.toastDurationMs).toBeLessThan(10000);
  });
});

describe("constants", () => {
  it("exports PRODUCT_NAME", () => {
    expect(PRODUCT_NAME).toBe("Desygn AI");
  });

  it("exports REPOSITORY_URL", () => {
    expect(REPOSITORY_URL).toContain("github.com");
  });
});

describe("getInitialTheme", () => {
  // Mock localStorage for node test env
  const mockStorage: Record<string, string> = {};
  beforeAll(() => {
    if (typeof globalThis.localStorage === "undefined") {
      Object.defineProperty(globalThis, "localStorage", {
        value: {
          getItem: (key: string) => mockStorage[key] ?? null,
          setItem: (key: string, value: string) => { mockStorage[key] = value; },
          removeItem: (key: string) => { delete mockStorage[key]; },
        },
        writable: true,
      });
    }
  });

  it("returns dark when no saved preference", () => {
    delete mockStorage["designready.theme"];
    expect(getInitialTheme()).toBe("dark");
  });

  it("returns light when saved as light", () => {
    mockStorage["designready.theme"] = "light";
    expect(getInitialTheme()).toBe("light");
    delete mockStorage["designready.theme"];
  });
});
