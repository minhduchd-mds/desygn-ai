/**
 * url — Parse Figma URLs to extract fileKey and optional nodeId.
 *
 * Accepted formats:
 *   https://www.figma.com/file/<fileKey>/<title>
 *   https://www.figma.com/file/<fileKey>/<title>?node-id=<id>
 *   https://www.figma.com/design/<fileKey>/<title>
 *   https://www.figma.com/design/<fileKey>/<title>?node-id=<id>
 */

export interface ParsedFigmaUrl {
  fileKey: string;
  nodeId?: string;
}

const FIGMA_FILE_PATTERN = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/;

export function parseFigmaUrl(url: string): ParsedFigmaUrl {
  const match = FIGMA_FILE_PATTERN.exec(url);
  if (!match) {
    throw new Error(`Invalid Figma URL: ${url}`);
  }

  const fileKey = match[1];
  let nodeId: string | undefined;

  try {
    const parsed = new URL(url);
    const nodeIdParam = parsed.searchParams.get("node-id");
    if (nodeIdParam) {
      // Figma URL encoding uses "-" but API uses ":"
      nodeId = nodeIdParam.replace(/-/g, ":");
    }
  } catch {
    // Ignore URL parse errors — fileKey regex already validated
  }

  return { fileKey, nodeId };
}
