import type { Screen } from "../design/screenGenerator";

export function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function combineScreens(screens: Screen[]): string {
  return screens.map((screen) => screen.markdown).join("\n\n---\n\n");
}

export function extractHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^##+\s+(.+)$/gm)].map((match) => match[1]);
}

export function countWords(markdown: string): number {
  const words = markdown.trim().match(/\S+/g);
  return words ? words.length : 0;
}

export function getScreenCompletionSummary(screen: Screen): {
  components: number;
  tokens: number;
  sections: number;
} {
  return {
    components: screen.components.length,
    tokens: screen.colorTokens.length,
    sections: extractHeadings(screen.markdown).length,
  };
}
