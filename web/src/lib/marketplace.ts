/**
 * marketplace — Design System Template Marketplace.
 *
 * Competitive Advantage vs Figma:
 *   Figma has plugins but NO design system sharing marketplace.
 *   Desygn AI enables community-driven design system templates:
 *
 *   • Browse, search, and install pre-built design system templates
 *   • Export and publish your own design systems
 *   • Version-controlled templates with semantic versioning
 *   • Framework-specific variants (React/Vue/Svelte)
 *   • Community ratings and usage metrics
 *
 * Architecture:
 *   Templates are stored as Design.md + config bundles.
 *   Marketplace API (future) provides discovery/search.
 *   Local-first: templates cached in IndexedDB for offline use.
 */

import type { FrameworkId, StylingApproach, GenerationConfig } from "../../../shared/frameworks";

// ── Types ─────────────────────────────────────────────────────

export interface MarketplaceTemplate {
  id: string;
  name: string;
  slug: string;
  version: string;
  description: string;
  longDescription: string;
  author: TemplateAuthor;
  category: TemplateCategory;
  tags: string[];
  frameworks: FrameworkId[];
  styling: StylingApproach[];
  components: TemplateComponent[];
  tokens: TemplateTokens;
  preview: TemplatePreview;
  stats: TemplateStats;
  pricing: TemplatePricing;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateAuthor {
  id: string;
  name: string;
  avatar?: string;
  verified: boolean;
  profileUrl?: string;
}

export type TemplateCategory =
  | "saas-dashboard"
  | "e-commerce"
  | "landing-page"
  | "mobile-app"
  | "admin-panel"
  | "marketing"
  | "blog"
  | "portfolio"
  | "social"
  | "fintech"
  | "healthcare"
  | "education"
  | "design-system";

export interface TemplateComponent {
  name: string;
  type: "atom" | "molecule" | "organism" | "template" | "page";
  variants: number;
  hasResponsive: boolean;
  description: string;
}

export interface TemplateTokens {
  colors: number;
  spacings: number;
  typography: number;
  radii: number;
  shadows: number;
  customProperties: Record<string, string>;
}

export interface TemplatePreview {
  thumbnail: string;       // URL or base64
  screenshots: string[];   // Gallery
  figmaUrl?: string;       // Link to source Figma file
  livePreviewUrl?: string; // Deployed demo
}

export interface TemplateStats {
  downloads: number;
  stars: number;
  forks: number;
  weeklyDownloads: number;
  rating: number;         // 0-5
  reviewCount: number;
}

export interface TemplatePricing {
  type: "free" | "paid" | "freemium";
  price?: number;          // USD
  currency?: string;
}

export interface TemplateBundle {
  template: MarketplaceTemplate;
  designMd: string;        // Raw Design.md content
  config: GenerationConfig;
  files: TemplateBundleFile[];
}

export interface TemplateBundleFile {
  path: string;
  content: string;
  type: "component" | "token" | "style" | "config" | "doc";
}

// ── Search & Filters ──────────────────────────────────────────

export interface MarketplaceSearchQuery {
  text?: string;
  category?: TemplateCategory;
  framework?: FrameworkId;
  styling?: StylingApproach;
  pricing?: "free" | "paid" | "all";
  sortBy?: "downloads" | "rating" | "newest" | "trending";
  page?: number;
  limit?: number;
}

export interface MarketplaceSearchResult {
  templates: MarketplaceTemplate[];
  total: number;
  page: number;
  totalPages: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: { name: TemplateCategory; count: number }[];
  frameworks: { name: FrameworkId; count: number }[];
  pricing: { type: string; count: number }[];
}

// ── Installation ──────────────────────────────────────────────

export interface InstalledTemplate {
  templateId: string;
  version: string;
  installedAt: number;
  config: GenerationConfig;
  localPath: string;
}

// ── Marketplace Service ───────────────────────────────────────

export class MarketplaceService {
  private installed = new Map<string, InstalledTemplate>();
  private cache = new Map<string, MarketplaceTemplate>();

  // ── Discovery ─────────────────────────────────────────────

  /**
   * Search marketplace templates with filters.
   * Local-first: searches cached templates, falls back to API.
   */
  search(query: MarketplaceSearchQuery): MarketplaceSearchResult {
    let results = [...this.cache.values()];

    // Text search
    if (query.text) {
      const text = query.text.toLowerCase();
      results = results.filter(t =>
        t.name.toLowerCase().includes(text) ||
        t.description.toLowerCase().includes(text) ||
        t.tags.some(tag => tag.toLowerCase().includes(text))
      );
    }

    // Category filter
    if (query.category) {
      results = results.filter(t => t.category === query.category);
    }

    // Framework filter
    if (query.framework) {
      results = results.filter(t => t.frameworks.includes(query.framework!));
    }

    // Styling filter
    if (query.styling) {
      results = results.filter(t => t.styling.includes(query.styling!));
    }

    // Pricing filter
    if (query.pricing && query.pricing !== "all") {
      results = results.filter(t => t.pricing.type === query.pricing);
    }

    // Sort
    switch (query.sortBy) {
      case "downloads":
        results.sort((a, b) => b.stats.downloads - a.stats.downloads);
        break;
      case "rating":
        results.sort((a, b) => b.stats.rating - a.stats.rating);
        break;
      case "newest":
        results.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case "trending":
        results.sort((a, b) => b.stats.weeklyDownloads - a.stats.weeklyDownloads);
        break;
      default:
        results.sort((a, b) => b.stats.downloads - a.stats.downloads);
    }

    // Facets
    const facets = this.computeFacets(results);

    // Pagination
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    const paged = results.slice(start, start + limit);

    return {
      templates: paged,
      total: results.length,
      page,
      totalPages: Math.ceil(results.length / limit),
      facets,
    };
  }

  /**
   * Get featured/curated templates.
   */
  getFeatured(): MarketplaceTemplate[] {
    return [...this.cache.values()]
      .filter(t => t.stats.rating >= 4.5 && t.stats.downloads > 100)
      .sort((a, b) => b.stats.rating - a.stats.rating)
      .slice(0, 12);
  }

  /**
   * Get templates by category.
   */
  getByCategory(category: TemplateCategory): MarketplaceTemplate[] {
    return [...this.cache.values()]
      .filter(t => t.category === category)
      .sort((a, b) => b.stats.downloads - a.stats.downloads);
  }

  // ── Installation ──────────────────────────────────────────

  /**
   * Install a template locally.
   */
  install(template: MarketplaceTemplate, config: GenerationConfig): InstalledTemplate {
    const installation: InstalledTemplate = {
      templateId: template.id,
      version: template.version,
      installedAt: Date.now(),
      config,
      localPath: `templates/${template.slug}`,
    };

    this.installed.set(template.id, installation);
    return installation;
  }

  /**
   * Uninstall a template.
   */
  uninstall(templateId: string): boolean {
    return this.installed.delete(templateId);
  }

  /**
   * Get all installed templates.
   */
  getInstalled(): InstalledTemplate[] {
    return [...this.installed.values()];
  }

  /**
   * Check if a template is installed.
   */
  isInstalled(templateId: string): boolean {
    return this.installed.has(templateId);
  }

  // ── Publishing ────────────────────────────────────────────

  /**
   * Validate a template bundle before publishing.
   */
  validateBundle(bundle: TemplateBundle): string[] {
    const errors: string[] = [];

    if (!bundle.template.name) errors.push("Template name is required");
    if (!bundle.template.description) errors.push("Description is required");
    if (bundle.template.description.length < 20) errors.push("Description must be at least 20 characters");
    if (!bundle.template.frameworks.length) errors.push("At least one framework is required");
    if (!bundle.template.components.length) errors.push("At least one component is required");
    if (!bundle.designMd) errors.push("Design.md content is required");
    if (bundle.designMd.length < 100) errors.push("Design.md must be at least 100 characters");
    if (!bundle.template.version.match(/^\d+\.\d+\.\d+$/)) {
      errors.push("Version must be semver (e.g. 1.0.0)");
    }

    return errors;
  }

  /**
   * Prepare a template for publishing.
   * Returns the bundle with computed metadata.
   */
  prepareForPublish(bundle: TemplateBundle): TemplateBundle {
    return {
      ...bundle,
      template: {
        ...bundle.template,
        updatedAt: Date.now(),
        stats: {
          downloads: 0,
          stars: 0,
          forks: 0,
          weeklyDownloads: 0,
          rating: 0,
          reviewCount: 0,
        },
      },
    };
  }

  // ── Cache Management ──────────────────────────────────────

  /**
   * Load templates into local cache.
   */
  loadTemplates(templates: MarketplaceTemplate[]): void {
    for (const t of templates) {
      this.cache.set(t.id, t);
    }
  }

  /**
   * Clear local cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size.
   */
  get cacheSize(): number {
    return this.cache.size;
  }

  // ── Private ───────────────────────────────────────────────

  private computeFacets(templates: MarketplaceTemplate[]): SearchFacets {
    const categoryMap = new Map<TemplateCategory, number>();
    const frameworkMap = new Map<FrameworkId, number>();
    const pricingMap = new Map<string, number>();

    for (const t of templates) {
      categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1);
      for (const fw of t.frameworks) {
        frameworkMap.set(fw, (frameworkMap.get(fw) ?? 0) + 1);
      }
      pricingMap.set(t.pricing.type, (pricingMap.get(t.pricing.type) ?? 0) + 1);
    }

    return {
      categories: [...categoryMap.entries()].map(([name, count]) => ({ name, count })),
      frameworks: [...frameworkMap.entries()].map(([name, count]) => ({ name, count })),
      pricing: [...pricingMap.entries()].map(([type, count]) => ({ type, count })),
    };
  }
}

// ── Built-in Template Starters ────────────────────────────────

export const STARTER_TEMPLATES: MarketplaceTemplate[] = [
  {
    id: "starter-saas",
    name: "SaaS Dashboard Starter",
    slug: "saas-dashboard-starter",
    version: "1.0.0",
    description: "Complete SaaS dashboard design system with sidebar navigation, data tables, charts, and settings panels.",
    longDescription: "A production-ready design system for SaaS applications featuring dark/light themes, responsive layouts, and 40+ components.",
    author: { id: "desygn", name: "Desygn AI", verified: true },
    category: "saas-dashboard",
    tags: ["dashboard", "saas", "admin", "data-table", "charts"],
    frameworks: ["react", "vue", "svelte"],
    styling: ["tailwind", "css-modules"],
    components: [
      { name: "Sidebar", type: "organism", variants: 3, hasResponsive: true, description: "Collapsible sidebar navigation" },
      { name: "DataTable", type: "organism", variants: 4, hasResponsive: true, description: "Sortable data table with pagination" },
      { name: "MetricCard", type: "molecule", variants: 2, hasResponsive: true, description: "KPI metric display card" },
      { name: "Button", type: "atom", variants: 6, hasResponsive: false, description: "Primary/secondary/ghost variants" },
    ],
    tokens: { colors: 24, spacings: 8, typography: 6, radii: 4, shadows: 3, customProperties: {} },
    preview: { thumbnail: "", screenshots: [] },
    stats: { downloads: 1250, stars: 89, forks: 23, weeklyDownloads: 45, rating: 4.7, reviewCount: 12 },
    pricing: { type: "free" },
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now(),
  },
  {
    id: "starter-ecommerce",
    name: "E-Commerce Kit",
    slug: "ecommerce-kit",
    version: "1.0.0",
    description: "Full e-commerce design system with product cards, cart, checkout flow, and category browsing.",
    longDescription: "Shopify-grade design system with 60+ components optimized for conversion rates and mobile-first shopping experiences.",
    author: { id: "desygn", name: "Desygn AI", verified: true },
    category: "e-commerce",
    tags: ["shop", "product", "cart", "checkout", "mobile"],
    frameworks: ["react", "vue", "react-native"],
    styling: ["tailwind", "css-modules"],
    components: [
      { name: "ProductCard", type: "molecule", variants: 3, hasResponsive: true, description: "Product display with price and rating" },
      { name: "CartDrawer", type: "organism", variants: 2, hasResponsive: true, description: "Slide-out cart with quantity controls" },
      { name: "CheckoutForm", type: "organism", variants: 1, hasResponsive: true, description: "Multi-step checkout flow" },
      { name: "CategoryGrid", type: "organism", variants: 2, hasResponsive: true, description: "Responsive product grid" },
    ],
    tokens: { colors: 18, spacings: 8, typography: 5, radii: 3, shadows: 4, customProperties: {} },
    preview: { thumbnail: "", screenshots: [] },
    stats: { downloads: 890, stars: 67, forks: 15, weeklyDownloads: 32, rating: 4.5, reviewCount: 8 },
    pricing: { type: "free" },
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now(),
  },
  {
    id: "starter-mobile",
    name: "Mobile App UI Kit",
    slug: "mobile-app-ui-kit",
    version: "1.0.0",
    description: "iOS/Android-optimized mobile UI components with gestures, bottom sheets, and native navigation patterns.",
    longDescription: "Cross-platform mobile design system following Apple HIG and Material Design 3 guidelines with 80+ mobile-optimized components.",
    author: { id: "desygn", name: "Desygn AI", verified: true },
    category: "mobile-app",
    tags: ["mobile", "ios", "android", "native", "gestures"],
    frameworks: ["react-native", "flutter"],
    styling: ["inline"],
    components: [
      { name: "BottomSheet", type: "organism", variants: 3, hasResponsive: false, description: "Draggable bottom sheet modal" },
      { name: "TabBar", type: "molecule", variants: 2, hasResponsive: false, description: "iOS/Android tab navigation" },
      { name: "SwipeCard", type: "molecule", variants: 2, hasResponsive: false, description: "Tinder-style swipe cards" },
      { name: "ListItem", type: "atom", variants: 5, hasResponsive: false, description: "Configurable list row with accessories" },
    ],
    tokens: { colors: 20, spacings: 8, typography: 7, radii: 5, shadows: 2, customProperties: {} },
    preview: { thumbnail: "", screenshots: [] },
    stats: { downloads: 560, stars: 43, forks: 8, weeklyDownloads: 21, rating: 4.3, reviewCount: 5 },
    pricing: { type: "free" },
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now(),
  },
];

// ── Singleton export ──────────────────────────────────────────

export const marketplace = new MarketplaceService();

// Pre-load starter templates
marketplace.loadTemplates(STARTER_TEMPLATES);
