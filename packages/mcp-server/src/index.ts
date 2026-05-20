#!/usr/bin/env node
/**
 * Desygn AI MCP Server
 *
 * Exposes Figma design system context (components, tokens, pages)
 * to AI coding agents via the Model Context Protocol (stdio transport).
 *
 * Usage:
 *   desygn-mcp                        # Start with no snapshot
 *   desygn-mcp --snapshot ./snap.json # Pre-load a snapshot at startup
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadSnapshotFromFile } from "./store.js";

import { getDesignTokensInput, handleGetDesignTokens } from "./tools/getDesignTokens.js";
import { getComponentsInput, handleGetComponents } from "./tools/getComponents.js";
import { handleGetDesignSummary } from "./tools/getDesignSummary.js";
import { matchComponentInput, handleMatchComponent } from "./tools/matchComponent.js";
import { loadSnapshotInput, handleLoadSnapshot } from "./tools/loadSnapshot.js";
import { auditFigmaInput, handleAuditFigmaForA11y } from "./tools/auditFigmaForA11y.js";

import {
  GET_DESIGN_TOKENS_SCHEMA,
} from "./tools/getDesignTokens.js";
import {
  GET_COMPONENTS_SCHEMA,
} from "./tools/getComponents.js";
import {
  GET_DESIGN_SUMMARY_SCHEMA,
} from "./tools/getDesignSummary.js";
import {
  MATCH_COMPONENT_SCHEMA,
} from "./tools/matchComponent.js";
import {
  LOAD_SNAPSHOT_SCHEMA,
} from "./tools/loadSnapshot.js";
import {
  AUDIT_FIGMA_SCHEMA,
} from "./tools/auditFigmaForA11y.js";

// ─── Parse CLI args ──────────────────────────────────────────────────
function parseArgs(argv: string[]): { snapshotPath?: string } {
  const idx = argv.indexOf("--snapshot");
  if (idx !== -1 && idx + 1 < argv.length) {
    return { snapshotPath: argv[idx + 1] };
  }
  return {};
}

// ─── Main ────────────────────────────────────────────────────────────
async function main() {
  const { snapshotPath } = parseArgs(process.argv);

  // Pre-load snapshot if provided
  if (snapshotPath) {
    try {
      const snap = await loadSnapshotFromFile(snapshotPath);
      console.error(
        `[desygn-mcp] Loaded snapshot: "${snap.fileName}" ` +
        `(${snap.components.length} components, ${snap.variables.length} tokens)`
      );
    } catch (err) {
      console.error(`[desygn-mcp] Failed to load snapshot: ${err}`);
      process.exit(1);
    }
  }

  // Create MCP server
  const server = new McpServer({
    name: "desygn-mcp",
    version: "0.1.0",
  });

  // ─── Register tools ──────────────────────────────────────────────

  server.tool(
    GET_DESIGN_TOKENS_SCHEMA.name,
    GET_DESIGN_TOKENS_SCHEMA.description,
    getDesignTokensInput.shape,
    async (args) => handleGetDesignTokens(args),
  );

  server.tool(
    GET_COMPONENTS_SCHEMA.name,
    GET_COMPONENTS_SCHEMA.description,
    getComponentsInput.shape,
    async (args) => handleGetComponents(args),
  );

  server.tool(
    GET_DESIGN_SUMMARY_SCHEMA.name,
    GET_DESIGN_SUMMARY_SCHEMA.description,
    {},
    async () => handleGetDesignSummary(),
  );

  server.tool(
    MATCH_COMPONENT_SCHEMA.name,
    MATCH_COMPONENT_SCHEMA.description,
    matchComponentInput.shape,
    async (args) => handleMatchComponent(args),
  );

  server.tool(
    LOAD_SNAPSHOT_SCHEMA.name,
    LOAD_SNAPSHOT_SCHEMA.description,
    loadSnapshotInput.shape,
    async (args) => handleLoadSnapshot(args),
  );

  server.tool(
    AUDIT_FIGMA_SCHEMA.name,
    AUDIT_FIGMA_SCHEMA.description,
    auditFigmaInput.shape,
    async (args) => handleAuditFigmaForA11y(args),
  );

  // ─── Start stdio transport ───────────────────────────────────────
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[desygn-mcp] Server started (stdio transport)");
}

main().catch((err) => {
  console.error("[desygn-mcp] Fatal error:", err);
  process.exit(1);
});
