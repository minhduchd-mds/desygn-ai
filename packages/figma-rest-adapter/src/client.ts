/**
 * client — Figma REST API client.
 *
 * Authenticates with personal access token (X-Figma-Token header).
 * For each audit run, the customer's token is passed in — Desygn does
 * not store Figma tokens long-term (only encrypted-at-rest in
 * `api_keys` table if user opts in).
 */

import { LruCache } from "./cache.js";

const FIGMA_API_BASE = "https://api.figma.com/v1";

export class FigmaApiError extends Error {
  constructor(public readonly status: number, public readonly body: string) {
    super(`Figma API error ${status}: ${body.slice(0, 200)}`);
    this.name = "FigmaApiError";
  }
}

export interface FigmaFileResponse {
  document: unknown;
  components: Record<string, unknown>;
  styles: Record<string, unknown>;
  name: string;
  lastModified: string;
  version: string;
}

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string>;
}

export class FigmaRestClient {
  constructor(
    private readonly token: string,
    private readonly cache: LruCache<unknown> = new LruCache(100, 300),
  ) {
    if (!token) {
      throw new Error("Figma access token is required");
    }
  }

  /** Fetch a Figma file or specific nodes within it. */
  async getFile(fileKey: string, nodeIds?: string[]): Promise<FigmaFileResponse> {
    const cacheKey = `file:${fileKey}:${nodeIds?.sort().join(",") ?? "all"}`;
    const cached = this.cache.get(cacheKey) as FigmaFileResponse | undefined;
    if (cached) return cached;

    const url = new URL(`${FIGMA_API_BASE}/files/${fileKey}`);
    if (nodeIds?.length) {
      url.searchParams.set("ids", nodeIds.join(","));
    }
    url.searchParams.set("depth", "100");
    url.searchParams.set("geometry", "paths");

    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.token },
    });

    if (!res.ok) {
      throw new FigmaApiError(res.status, await res.text());
    }

    const data = (await res.json()) as FigmaFileResponse;
    this.cache.set(cacheKey, data, 300);
    return data;
  }

  /** Get rendered PNG URLs for nodes (for PDF report screenshots). */
  async getImages(fileKey: string, nodeIds: string[]): Promise<Record<string, string>> {
    if (nodeIds.length === 0) return {};

    const url = new URL(`${FIGMA_API_BASE}/images/${fileKey}`);
    url.searchParams.set("ids", nodeIds.join(","));
    url.searchParams.set("format", "png");
    url.searchParams.set("scale", "2");

    const res = await fetch(url, {
      headers: { "X-Figma-Token": this.token },
    });

    if (!res.ok) {
      throw new FigmaApiError(res.status, await res.text());
    }

    const data = (await res.json()) as FigmaImagesResponse;
    if (data.err) {
      throw new FigmaApiError(500, data.err);
    }
    return data.images;
  }
}
