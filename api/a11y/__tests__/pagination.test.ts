/**
 * pagination — unit tests for the audit-list cursor helpers.
 *
 * Pure, deterministic, no I/O.
 */

import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor } from "../_pagination.js";

describe("encodeCursor / decodeCursor round-trip", () => {
  it("round-trips a simple cursor", () => {
    const c = { t: "2026-05-31T12:34:56.789Z", i: "00000000-0000-4000-8000-000000000001" };
    const encoded = encodeCursor(c);
    expect(typeof encoded).toBe("string");
    expect(encoded.length).toBeGreaterThan(0);
    expect(decodeCursor(encoded)).toEqual(c);
  });

  it("produces a URL-safe (base64url) string", () => {
    const c = { t: "2026-05-31T00:00:00.000Z", i: "11111111-1111-4111-8111-111111111111" };
    const encoded = encodeCursor(c);
    // base64url has no `+`, `/`, or `=` padding.
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("round-trips many different cursors", () => {
    for (let n = 0; n < 25; n++) {
      const c = {
        t: new Date(Date.UTC(2026, 4, (n % 28) + 1, n % 24, n % 60, n % 60)).toISOString(),
        i: `aaaaaaaa-bbbb-4ccc-8ddd-${n.toString().padStart(12, "0")}`,
      };
      expect(decodeCursor(encodeCursor(c))).toEqual(c);
    }
  });
});

describe("decodeCursor — defensive against garbage", () => {
  it("returns null on the empty string", () => {
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null on plain garbage characters", () => {
    expect(decodeCursor("@@@not-base64@@@")).toBeNull();
  });

  it("returns null on valid base64 of non-JSON content", () => {
    // "not json at all" is valid base64-decodable but isn't JSON.
    const b64 = Buffer.from("not json at all", "utf-8").toString("base64");
    // Convert to base64url form (no padding).
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeCursor(b64url)).toBeNull();
  });

  it("returns null on valid JSON missing required fields", () => {
    const b64 = Buffer.from(JSON.stringify({ foo: "bar" }), "utf-8").toString("base64");
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeCursor(b64url)).toBeNull();
  });

  it("returns null when fields are present but wrong-typed", () => {
    const b64 = Buffer.from(JSON.stringify({ t: 123, i: 456 }), "utf-8").toString("base64");
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeCursor(b64url)).toBeNull();
  });

  it("returns null on empty-string fields", () => {
    const b64 = Buffer.from(JSON.stringify({ t: "", i: "" }), "utf-8").toString("base64");
    const b64url = b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    expect(decodeCursor(b64url)).toBeNull();
  });

  it("returns null on malformed base64url input", () => {
    // Characters outside the base64url alphabet — re-pads, then fails decode.
    expect(decodeCursor("!!!")).toBeNull();
  });
});
