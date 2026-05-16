/**
 * frameworks — Multi-framework code generation definitions.
 *
 * Competitive Advantage vs Figma:
 *   Figma will likely ship React-first code gen.
 *   Design-md-ai supports ALL major frameworks from Day 1:
 *   React, Vue, Svelte, Web Components, Flutter, React Native.
 *
 * Architecture:
 *   SerializedNode → FrameworkAdapter → Generated Code
 *   Same Design.md format produces framework-specific output.
 *
 * Each adapter implements:
 *   1. Component scaffold (file structure)
 *   2. Props/types mapping
 *   3. Styling approach (CSS Modules, Tailwind, styled-components, etc.)
 *   4. State management conventions
 */

// ── Framework Definitions ─────────────────────────────────────

export type FrameworkId =
  | "react"
  | "vue"
  | "svelte"
  | "webcomponents"
  | "flutter"
  | "react-native"
  | "angular"
  | "solid";

export type StylingApproach =
  | "css-modules"
  | "tailwind"
  | "styled-components"
  | "scss"
  | "emotion"
  | "vanilla-extract"
  | "uno-css"
  | "inline"; // Flutter, React Native

export type StateManagement =
  | "hooks"         // React useState/useReducer
  | "composition"   // Vue Composition API
  | "stores"        // Svelte stores
  | "signals"       // Solid/Angular signals
  | "bloc"          // Flutter BLoC
  | "riverpod"      // Flutter Riverpod
  | "none";

export interface FrameworkConfig {
  id: FrameworkId;
  name: string;
  fileExtension: string;
  styleExtension: string;
  typeSystem: "typescript" | "dart" | "none";
  styling: StylingApproach[];   // Supported styling approaches
  stateManagement: StateManagement[];
  features: FrameworkFeature[];
}

export interface FrameworkFeature {
  id: string;
  name: string;
  description: string;
  default: boolean;
}

// ── Framework Registry ────────────────────────────────────────

export const FRAMEWORKS: Record<FrameworkId, FrameworkConfig> = {
  react: {
    id: "react",
    name: "React",
    fileExtension: ".tsx",
    styleExtension: ".module.scss",
    typeSystem: "typescript",
    styling: ["css-modules", "tailwind", "styled-components", "emotion", "vanilla-extract"],
    stateManagement: ["hooks"],
    features: [
      { id: "forwardRef", name: "forwardRef", description: "Wrap component with React.forwardRef", default: true },
      { id: "memo", name: "React.memo", description: "Memoize component for performance", default: false },
      { id: "suspense", name: "Suspense", description: "Add Suspense boundary for async content", default: false },
      { id: "errorBoundary", name: "Error Boundary", description: "Include error boundary wrapper", default: false },
      { id: "storybook", name: "Storybook", description: "Generate .stories.tsx file", default: true },
      { id: "test", name: "Test File", description: "Generate .test.tsx file", default: true },
    ],
  },

  vue: {
    id: "vue",
    name: "Vue 3",
    fileExtension: ".vue",
    styleExtension: ".scss",
    typeSystem: "typescript",
    styling: ["scss", "tailwind", "uno-css", "css-modules"],
    stateManagement: ["composition"],
    features: [
      { id: "scriptSetup", name: "<script setup>", description: "Use Composition API with script setup", default: true },
      { id: "defineProps", name: "defineProps", description: "Type-safe prop definitions", default: true },
      { id: "slots", name: "Named Slots", description: "Generate named slot structure", default: true },
      { id: "emits", name: "defineEmits", description: "Type-safe event emitting", default: true },
      { id: "test", name: "Test File", description: "Generate .spec.ts file", default: true },
    ],
  },

  svelte: {
    id: "svelte",
    name: "Svelte 5",
    fileExtension: ".svelte",
    styleExtension: ".scss",
    typeSystem: "typescript",
    styling: ["scss", "tailwind", "uno-css"],
    stateManagement: ["stores"],
    features: [
      { id: "runes", name: "Runes ($state)", description: "Use Svelte 5 runes for reactivity", default: true },
      { id: "snippets", name: "Snippets", description: "Use Svelte 5 snippets instead of slots", default: true },
      { id: "transitions", name: "Transitions", description: "Include transition directives", default: false },
      { id: "actions", name: "Actions", description: "Generate use: directives", default: false },
      { id: "test", name: "Test File", description: "Generate .test.ts file", default: true },
    ],
  },

  webcomponents: {
    id: "webcomponents",
    name: "Web Components",
    fileExtension: ".ts",
    styleExtension: ".css",
    typeSystem: "typescript",
    styling: ["css-modules"],
    stateManagement: ["none"],
    features: [
      { id: "shadow", name: "Shadow DOM", description: "Use Shadow DOM for encapsulation", default: true },
      { id: "attributes", name: "Observed Attributes", description: "Map props to HTML attributes", default: true },
      { id: "events", name: "Custom Events", description: "Dispatch CustomEvents for communication", default: true },
      { id: "form", name: "Form Associated", description: "Implement ElementInternals for form participation", default: false },
    ],
  },

  flutter: {
    id: "flutter",
    name: "Flutter",
    fileExtension: ".dart",
    styleExtension: ".dart",
    typeSystem: "dart",
    styling: ["inline"],
    stateManagement: ["bloc", "riverpod"],
    features: [
      { id: "stateless", name: "StatelessWidget", description: "Generate as StatelessWidget", default: true },
      { id: "stateful", name: "StatefulWidget", description: "Generate as StatefulWidget", default: false },
      { id: "freezed", name: "Freezed", description: "Use freezed for immutable state", default: false },
      { id: "responsive", name: "Responsive", description: "Include MediaQuery-based responsive layout", default: true },
    ],
  },

  "react-native": {
    id: "react-native",
    name: "React Native",
    fileExtension: ".tsx",
    styleExtension: ".ts",
    typeSystem: "typescript",
    styling: ["inline", "tailwind"],
    stateManagement: ["hooks"],
    features: [
      { id: "stylesheet", name: "StyleSheet", description: "Use StyleSheet.create for styles", default: true },
      { id: "nativewind", name: "NativeWind", description: "Use NativeWind (Tailwind for RN)", default: false },
      { id: "platform", name: "Platform-specific", description: "Include Platform.select for iOS/Android differences", default: false },
      { id: "accessibility", name: "Accessibility", description: "Include accessibilityLabel and roles", default: true },
    ],
  },

  angular: {
    id: "angular",
    name: "Angular",
    fileExtension: ".ts",
    styleExtension: ".scss",
    typeSystem: "typescript",
    styling: ["scss", "tailwind"],
    stateManagement: ["signals"],
    features: [
      { id: "standalone", name: "Standalone", description: "Generate as standalone component", default: true },
      { id: "signals", name: "Signals", description: "Use Angular signals for reactivity", default: true },
      { id: "inject", name: "inject()", description: "Use inject() instead of constructor DI", default: true },
      { id: "controlFlow", name: "@if/@for", description: "Use new control flow syntax", default: true },
    ],
  },

  solid: {
    id: "solid",
    name: "SolidJS",
    fileExtension: ".tsx",
    styleExtension: ".module.css",
    typeSystem: "typescript",
    styling: ["css-modules", "tailwind", "vanilla-extract"],
    stateManagement: ["signals"],
    features: [
      { id: "signals", name: "Signals", description: "Use createSignal for reactive state", default: true },
      { id: "show", name: "Show/For", description: "Use <Show>/<For> for conditional/list rendering", default: true },
      { id: "suspense", name: "Suspense", description: "Add Suspense for async resources", default: false },
    ],
  },
};

// ── Code Generation Template Interfaces ───────────────────────

export interface GenerationConfig {
  framework: FrameworkId;
  styling: StylingApproach;
  stateManagement: StateManagement;
  features: string[];  // Feature IDs enabled
  naming: NamingConvention;
  output: OutputConfig;
}

export interface NamingConvention {
  component: "PascalCase" | "kebab-case";
  file: "PascalCase" | "kebab-case" | "camelCase";
  css: "camelCase" | "kebab-case" | "BEM";
  props: "camelCase" | "snake_case";
}

export interface OutputConfig {
  /** Generate index barrel file */
  barrel: boolean;
  /** Include component documentation */
  docs: boolean;
  /** Target directory structure */
  structure: "flat" | "grouped" | "atomic";
  /** Base path for imports */
  basePath: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: "component" | "style" | "test" | "story" | "types" | "barrel";
}

export interface GenerationResult {
  files: GeneratedFile[];
  framework: FrameworkId;
  componentName: string;
  warnings: string[];
}

// ── Utilities ─────────────────────────────────────────────────

/** Get default generation config for a framework */
export function getDefaultConfig(framework: FrameworkId): GenerationConfig {
  const fw = FRAMEWORKS[framework];
  return {
    framework,
    styling: fw.styling[0],
    stateManagement: fw.stateManagement[0],
    features: fw.features.filter(f => f.default).map(f => f.id),
    naming: {
      component: "PascalCase",
      file: framework === "vue" || framework === "svelte" ? "PascalCase" : "PascalCase",
      css: framework === "react" ? "camelCase" : "kebab-case",
      props: "camelCase",
    },
    output: {
      barrel: true,
      docs: false,
      structure: "grouped",
      basePath: "src/components",
    },
  };
}

/** Get framework display info for UI */
export function getFrameworkList(): Array<{ id: FrameworkId; name: string; extensions: string }> {
  return Object.values(FRAMEWORKS).map(fw => ({
    id: fw.id,
    name: fw.name,
    extensions: `${fw.fileExtension} + ${fw.styleExtension}`,
  }));
}

/** Check if a framework supports a specific styling approach */
export function supportsStyle(framework: FrameworkId, style: StylingApproach): boolean {
  return FRAMEWORKS[framework].styling.includes(style);
}
