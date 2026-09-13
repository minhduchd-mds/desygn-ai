import { readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const primitivesDir = join(root, "packages/ui/src/primitives");
const allowedExtensions = new Set([".css", ".ts", ".tsx"]);

const checks = [
  {
    name: "raw color literal",
    regex: /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|lab|lch)\s*\(/i,
    help: "Move literal colors to packages/ui/src/tokens/tokens.css and consume a semantic CSS variable.",
  },
  {
    name: "palette token used directly by a primitive",
    regex: /var\(--color-(?:primary|slate)-\d+\)|var\(--color-(?:success|warning|error|info)\)/i,
    help: "Use a semantic alias such as --surface-*, --action-*, --status-*, --control-* or --avatar-*.",
  },
];

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else if (allowedExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const violations = [];
for (const file of walk(primitivesDir)) {
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const check of checks) {
      if (check.regex.test(line)) {
        violations.push({
          file: relative(root, file).replaceAll("\\", "/"),
          line: index + 1,
          kind: check.name,
          text: line.trim(),
          help: check.help,
        });
      }
    }
  });
}

if (violations.length > 0) {
  console.error("Design-system semantic token check failed:");
  for (const violation of violations) {
    console.error(`- ${violation.file}:${violation.line} ${violation.kind}`);
    console.error(`  ${violation.text}`);
    console.error(`  ${violation.help}`);
  }
  process.exit(1);
}

console.log("Design-system semantic token check passed.");
