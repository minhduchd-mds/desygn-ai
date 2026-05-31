/**
 * getInngest — env-gated singleton tests.
 *
 * Verifies the degrade-to-null behaviour when either INNGEST_EVENT_KEY or
 * INNGEST_SIGNING_KEY is missing, and confirms memoization is reset
 * cleanly between tests via __resetInngestForTests().
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { __resetInngestForTests, getInngest, INNGEST_APP_ID } from "../client.js";

const ENV_KEYS = ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY"] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const snapshot: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key];
  }
  return snapshot;
}

function restoreEnv(snapshot: Record<string, string | undefined>): void {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("INNGEST_APP_ID", () => {
  it("uses the stable desygn-a11y app id", () => {
    expect(INNGEST_APP_ID).toBe("desygn-a11y");
  });
});

describe("getInngest", () => {
  let envSnapshot: Record<string, string | undefined> = {};

  beforeEach(() => {
    envSnapshot = snapshotEnv();
    delete process.env.INNGEST_EVENT_KEY;
    delete process.env.INNGEST_SIGNING_KEY;
    __resetInngestForTests();
  });

  afterEach(() => {
    restoreEnv(envSnapshot);
    __resetInngestForTests();
  });

  it("returns null when both env vars are missing", () => {
    expect(getInngest()).toBeNull();
  });

  it("returns null when only INNGEST_EVENT_KEY is set", () => {
    process.env.INNGEST_EVENT_KEY = "evt";
    expect(getInngest()).toBeNull();
  });

  it("returns null when only INNGEST_SIGNING_KEY is set", () => {
    process.env.INNGEST_SIGNING_KEY = "sig";
    expect(getInngest()).toBeNull();
  });

  it("returns a non-null memoized client when both env vars are set", () => {
    process.env.INNGEST_EVENT_KEY = "evt";
    process.env.INNGEST_SIGNING_KEY = "sig";
    const a = getInngest();
    const b = getInngest();
    expect(a).not.toBeNull();
    expect(a).toBe(b);
  });

  it("rebuilds the client after __resetInngestForTests is called", () => {
    process.env.INNGEST_EVENT_KEY = "evt";
    process.env.INNGEST_SIGNING_KEY = "sig";
    const first = getInngest();
    __resetInngestForTests();
    const second = getInngest();
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first).not.toBe(second);
  });
});
