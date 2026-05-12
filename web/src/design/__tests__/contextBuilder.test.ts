import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import { buildContext, parseFileSources } from "../contextBuilder";
import { clearCache } from "../../lib/requestCache";

afterEach(() => {
  vi.unstubAllGlobals();
  clearCache();
});

describe("parseFileSources", () => {
  it("reads markdown files into doc sources", async () => {
    const file = new File(["# PRD\nContent"], "prd.md", { type: "text/markdown" });

    await expect(parseFileSources([file])).resolves.toEqual([
      {
        filename: "prd.md",
        content: "# PRD\nContent",
        type: "md",
      },
    ]);
  });

  it("extracts markdown and text entries from zip files", async () => {
    const zip = new JSZip();
    zip.file("docs/prd.md", "# PRD");
    zip.file("notes.txt", "Plain notes");
    zip.file("image.png", "ignored");
    const blob = await zip.generateAsync({ type: "blob" });
    const file = new File([blob], "docs.zip", { type: "application/zip" });

    const sources = await parseFileSources([file]);

    expect(sources).toEqual([
      { filename: "docs/prd.md", content: "# PRD", type: "zip-entry" },
      { filename: "notes.txt", content: "Plain notes", type: "zip-entry" },
    ]);
  });
});

describe("buildContext", () => {
  it("uses bootstrap suggestions when no components are provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ components: ["Button", "Input", "Card"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const context = await buildContext({
      pluginScanResult: [],
      uploadedFiles: [],
      textPrompt: "Build a CRM dashboard",
    });

    expect(context.bootstrapSuggestions).toEqual(["Button", "Input", "Card"]);
    expect(fetchMock).toHaveBeenCalledWith("/api/bootstrap-context", expect.objectContaining({ method: "POST" }));
  });

  it("does not call bootstrap when scanned components exist", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const context = await buildContext({
      pluginScanResult: [{ id: "1", name: "Button", type: "COMPONENT" }],
      uploadedFiles: [],
      textPrompt: "Build a CRM dashboard",
    });

    expect(context.components).toHaveLength(1);
    expect(context.bootstrapSuggestions).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns cached bootstrap result on second call with same prompt", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ components: ["Button", "Input"] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const sources = { pluginScanResult: [], uploadedFiles: [], textPrompt: "Build a fintech app" };
    const ctx1 = await buildContext(sources);
    const ctx2 = await buildContext(sources);

    expect(ctx1.bootstrapSuggestions).toEqual(["Button", "Input"]);
    expect(ctx2.bootstrapSuggestions).toEqual(["Button", "Input"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
