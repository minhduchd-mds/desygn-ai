import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
]);

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".lan", ".home", ".corp"];

function parseIpv4(address: string): number[] | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return octets;
}

function isBlockedIpv4(address: string): boolean {
  const octets = parseIpv4(address);
  if (!octets) return true;
  const [a, b, c] = octets;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function extractMappedIpv4(address: string): string | null {
  const normalized = address.toLowerCase();
  const marker = "::ffff:";
  if (!normalized.startsWith(marker)) return null;
  const suffix = normalized.slice(marker.length);
  if (isIP(suffix) === 4) return suffix;

  const hex = suffix.split(":");
  if (hex.length !== 2) return null;
  const high = Number.parseInt(hex[0], 16);
  const low = Number.parseInt(hex[1], 16);
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null;
  return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
}

function isBlockedIpv6(address: string): boolean {
  const normalized = address.toLowerCase().split("%")[0];
  const mappedIpv4 = extractMappedIpv4(normalized);
  if (mappedIpv4) return isBlockedIpv4(mappedIpv4);

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

export function isPublicIpAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return !isBlockedIpv4(address);
  if (version === 6) return !isBlockedIpv6(address);
  return false;
}

function hasBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    BLOCKED_HOSTNAMES.has(normalized) ||
    BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
  );
}

/**
 * Validate that a URL can only reach the public web.
 *
 * This guard is intended for server-side endpoints that receive a URL from an
 * untrusted request. It rejects credentials, local/special hostnames and any
 * DNS answer that resolves to a private, loopback, link-local, multicast or
 * otherwise non-routable address.
 */
export async function validatePublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Target URL is invalid");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Target URL must use http or https");
  }
  if (url.username || url.password) {
    throw new Error("Target URL must not include credentials");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hasBlockedHostname(hostname)) {
    throw new Error("Target hostname is not allowed");
  }

  if (isIP(hostname)) {
    if (!isPublicIpAddress(hostname)) {
      throw new Error("Target IP address is not public");
    }
    return url;
  }

  let addresses: Awaited<ReturnType<typeof lookup>>;
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error("Target hostname could not be resolved");
  }

  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("Target hostname resolves to a non-public IP address");
  }

  return url;
}

export interface SafeFetchOptions extends RequestInit {
  maxRedirects?: number;
}

/**
 * Fetch a user-provided public URL without allowing automatic redirect hops to
 * bypass the network guard. Every redirect target is revalidated before the
 * next request.
 */
export async function safePublicFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const { maxRedirects = 4, ...fetchOptions } = options;
  let current = await validatePublicHttpUrl(rawUrl);

  for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
    const response = await fetch(current, {
      ...fetchOptions,
      redirect: "manual",
    });

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    if (redirectCount === maxRedirects) {
      throw new Error("Target URL redirected too many times");
    }

    const location = response.headers.get("location");
    if (!location) {
      throw new Error("Target URL returned a redirect without a location");
    }

    current = await validatePublicHttpUrl(new URL(location, current).toString());
  }

  throw new Error("Target URL could not be fetched safely");
}
