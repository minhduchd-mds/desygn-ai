import { afterEach, describe, expect, it } from "vitest";
import { clearCache, getCached, setCached } from "../requestCache";

afterEach(() => {
  clearCache();
});

describe("requestCache", () => {
  it("returns undefined for a key that was never set", () => {
    expect(getCached({ key: "missing" })).toBeUndefined();
  });

  it("returns the value after it is set", () => {
    setCached({ prompt: "hello" }, ["Button", "Card"]);
    expect(getCached<string[]>({ prompt: "hello" })).toEqual(["Button", "Card"]);
  });

  it("distinguishes keys by deep equality", () => {
    setCached({ a: 1 }, "first");
    setCached({ a: 2 }, "second");
    expect(getCached({ a: 1 })).toBe("first");
    expect(getCached({ a: 2 })).toBe("second");
  });

  it("clears all entries", () => {
    setCached("k1", "v1");
    setCached("k2", "v2");
    clearCache();
    expect(getCached("k1")).toBeUndefined();
    expect(getCached("k2")).toBeUndefined();
  });
});
