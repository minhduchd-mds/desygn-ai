import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const staticDir = resolve(root, process.argv[2] ?? "storybook-static");
const outputDir = resolve(root, process.argv[3] ?? "visual-artifacts/storybook");
const indexPath = join(staticDir, "index.json");

if (!existsSync(indexPath)) {
  throw new Error(`Storybook index not found: ${relative(root, indexPath)}`);
}

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function safePathname(urlString) {
  const pathname = decodeURIComponent(new URL(urlString, "http://localhost").pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const candidate = normalize(join(staticDir, requested));
  const prefix = `${staticDir}${sep}`;
  if (candidate !== staticDir && !candidate.startsWith(prefix)) return null;
  return candidate;
}

const server = createServer(async (req, res) => {
  try {
    const path = safePathname(req.url ?? "/");
    if (!path) {
      res.writeHead(400).end("Bad request");
      return;
    }
    const info = await stat(path);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(path);
    res.writeHead(200, {
      "content-type": MIME[extname(path).toLowerCase()] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404).end("Not found");
  }
});

await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});

const address = server.address();
if (!address || typeof address === "string") throw new Error("Could not resolve visual server port");
const baseUrl = `http://127.0.0.1:${address.port}`;

const index = JSON.parse(readFileSync(indexPath, "utf8"));
const entries = Object.values(index.entries ?? index.stories ?? {});
const uiStories = entries.filter(
  (entry) => entry?.type === "story" && String(entry.title ?? "").startsWith("Desygn UI/"),
);

if (uiStories.length === 0) {
  server.close();
  throw new Error("No `Desygn UI/` Storybook stories found for visual verification");
}

const priority = ["AllVariants", "Default", "Primary", "Basic"];
const grouped = new Map();
for (const story of uiStories) {
  const key = story.title;
  const current = grouped.get(key);
  if (!current) {
    grouped.set(key, story);
    continue;
  }
  const nextRank = priority.indexOf(story.name);
  const currentRank = priority.indexOf(current.name);
  const normalizedNext = nextRank === -1 ? Number.MAX_SAFE_INTEGER : nextRank;
  const normalizedCurrent = currentRank === -1 ? Number.MAX_SAFE_INTEGER : currentRank;
  if (normalizedNext < normalizedCurrent) grouped.set(key, story);
}

const selected = [...grouped.values()].sort((a, b) => String(a.title).localeCompare(String(b.title)));
const viewports = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 1024, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const manifest = [];

try {
  const page = await browser.newPage();
  for (const story of selected) {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const url = `${baseUrl}/iframe.html?id=${encodeURIComponent(story.id)}&viewMode=story`;
      const response = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      if (!response?.ok()) throw new Error(`Failed to render ${story.id}: HTTP ${response?.status()}`);
      await page.addStyleTag({
        content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
      });
      await page.locator("body").waitFor({ state: "visible" });
      const slug = `${story.id}-${viewport.name}`.replace(/[^a-z0-9._-]+/gi, "-");
      const file = join(outputDir, `${slug}.png`);
      await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
      manifest.push({
        storyId: story.id,
        title: story.title,
        story: story.name,
        viewport,
        file: relative(root, file).replaceAll("\\", "/"),
      });
    }
  }
} finally {
  await browser.close();
  server.close();
}

await writeFile(join(outputDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Captured ${manifest.length} visual artifacts across ${selected.length} shared UI components.`);
