# @desygn/mcp-server

Model Context Protocol (MCP) server exposing Desygn AI design-system
context to AI coding agents (Claude Code, Cursor, Windsurf). stdio transport.

## Install / run

```bash
npx @desygn/mcp-server --snapshot ./design-snapshot.json
```

Or wire it into an MCP client config:

```json
{
  "mcpServers": {
    "desygn": {
      "command": "npx",
      "args": ["@desygn/mcp-server", "--snapshot", "./design-snapshot.json"]
    }
  }
}
```

The snapshot JSON is exported by the Desygn AI Figma plugin and contains
components, design tokens (variables), and page metadata.

## Tools (5)

| Tool | Purpose |
|---|---|
| `load_snapshot` | Load a design snapshot from disk at runtime |
| `get_design_tokens` | List variables, filter by type / collection |
| `get_components` | List components, filter by name / page / role / source / type |
| `get_design_summary` | High-level overview with role + variable-type distributions |
| `match_component` | Fuzzy-match a component for a UI need (Jaccard + substring + role boost) |

## Development

```bash
npm run dev        # tsx watch
npm run build      # tsc → dist/
npm run typecheck
```

## License

MIT
