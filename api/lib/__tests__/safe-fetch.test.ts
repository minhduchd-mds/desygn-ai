import { lookup } from "node:dns/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isPublicIpAddress,
  safePublicFetch,
  validatePublicHttpUrl,
} from "../safe-fetch.js";

vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(),
}));

const lookupMock = vi.mocked(lookup);
const fetchMock = vi.fn<typeof fetch>();

function mockDns(addresses: Array<{ address: string; family: 4 | 6 }>): void {
  lookupMock.mockResolvedValue(addresses as never);
}

describe("safe-fetch public network guard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    mockDns([{ address: "93.184.216.34", family: 4 }]);
  });

  afterEach(() => {
    fetchMock.mockReset();
    lookupMock.mockReset();
    vi.unstubAllGlobals();
  });

  describe("isPublicIpAddress", () => {
    it("allows routable public IPv4 and IPv6 addresses", () => {
      expect(isPublicIpAddress("8.8.8.8")).toBe(true);
      expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
    });

    it("blocks private, loopback, link-local, multicast and mapped-private addresses", () => {
      const blocked = [
        "0.0.0.0",
        "10.0.0.1",
        "127.0.0.1",
        "100.64.0.1",
        "169.254.169.254",
        "172.16.0.1",
        "192.168.1.1",
        "224.0.0.1",
        "::",
        "::1",
        "fc00::1",
        "fe80::1",
        "ff02::1",
        "::ffff:127.0.0.1",
      ];

      for (const address of blocked) {
        expect(isPublicIpAddress(address), address).toBe(false);
      }
      expect(isPublicIpAddress("not-an-ip")).toBe(false);
    });
  });

  describe("validatePublicHttpUrl", () => {
    it("rejects malformed URLs, unsupported protocols and embedded credentials", async () => {
      await expect(validatePublicHttpUrl("not a url")).rejects.toThrow("invalid");
      await expect(validatePublicHttpUrl("file:///etc/passwd")).rejects.toThrow("http or https");
      await expect(validatePublicHttpUrl("https://user:pass@example.com")).rejects.toThrow(
        "credentials",
      );
    });

    it("rejects local/special hostnames and direct private IPs before DNS", async () => {
      await expect(validatePublicHttpUrl("http://localhost/admin")).rejects.toThrow(
        "hostname is not allowed",
      );
      await expect(validatePublicHttpUrl("http://service.internal/data")).rejects.toThrow(
        "hostname is not allowed",
      );
      await expect(validatePublicHttpUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
        "IP address is not public",
      );
      expect(lookupMock).not.toHaveBeenCalled();
    });

    it("accepts a direct public IP without DNS resolution", async () => {
      const result = await validatePublicHttpUrl("https://8.8.8.8/status");
      expect(result.hostname).toBe("8.8.8.8");
      expect(lookupMock).not.toHaveBeenCalled();
    });

    it("accepts a hostname only when every DNS answer is public", async () => {
      mockDns([
        { address: "93.184.216.34", family: 4 },
        { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
      ]);

      const result = await validatePublicHttpUrl("https://example.com/path");
      expect(result.hostname).toBe("example.com");
      expect(lookupMock).toHaveBeenCalledWith("example.com", { all: true, verbatim: true });
    });

    it("rejects hostnames with any private DNS answer", async () => {
      mockDns([
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.9", family: 4 },
      ]);

      await expect(validatePublicHttpUrl("https://example.com")).rejects.toThrow(
        "non-public IP address",
      );
    });

    it("rejects unresolved hostnames and empty DNS answers", async () => {
      lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
      await expect(validatePublicHttpUrl("https://missing.example")).rejects.toThrow(
        "could not be resolved",
      );

      mockDns([]);
      await expect(validatePublicHttpUrl("https://empty.example")).rejects.toThrow(
        "non-public IP address",
      );
    });
  });

  describe("safePublicFetch", () => {
    it("returns a non-redirect response and forces manual redirect handling", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response("ok", { status: 200, headers: { "content-type": "text/plain" } }),
      );

      const response = await safePublicFetch("https://8.8.8.8/resource", {
        headers: { "x-test": "1" },
      });

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.objectContaining({ hostname: "8.8.8.8" }),
        expect.objectContaining({ redirect: "manual", headers: { "x-test": "1" } }),
      );
    });

    it("follows a public redirect only after validating the next target", async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(null, { status: 302, headers: { location: "https://1.1.1.1/next" } }),
        )
        .mockResolvedValueOnce(new Response("done", { status: 200 }));

      const response = await safePublicFetch("https://8.8.8.8/start");

      expect(response.status).toBe(200);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("blocks a redirect hop into a private network before making the second request", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { location: "http://127.0.0.1/admin" } }),
      );

      await expect(safePublicFetch("https://8.8.8.8/start")).rejects.toThrow(
        "IP address is not public",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("rejects redirects without a location header", async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 302 }));

      await expect(safePublicFetch("https://8.8.8.8/start")).rejects.toThrow(
        "redirect without a location",
      );
    });

    it("enforces the redirect limit", async () => {
      fetchMock.mockResolvedValueOnce(
        new Response(null, { status: 301, headers: { location: "https://1.1.1.1/next" } }),
      );

      await expect(safePublicFetch("https://8.8.8.8/start", { maxRedirects: 0 })).rejects.toThrow(
        "redirected too many times",
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
