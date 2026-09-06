/**
 * Public-safe checklist seed data.
 *
 * Proprietary/customer-specific rule packs are intentionally NOT bundled in the
 * repository. Load private rule packs at runtime from an approved private source.
 */

export type DesignSource = "vts" | "ant" | "m3" | "wcag";
export type CriteriaTag = "req" | "opt";
export type ChecklistStatus = "pass" | "fail" | "warn" | "untested";

export interface ChecklistRow {
  id: string;
  source: DesignSource;
  category: string;
  component: string;
  section: string;
  criterion: string;
  expected: string;
  note: string;
  tag: CriteriaTag;
  type: "UI" | "UX";
  status: ChecklistStatus;
  score: number;
}

export const DESIGN_SOURCES: { id: DesignSource; label: string; color: string; count: number }[] = [
  { id: "vts", label: "Private rule pack", color: "#6b7280", count: 0 },
  { id: "ant", label: "Ant Design", color: "#1677ff", count: 1 },
  { id: "m3", label: "Material 3", color: "#7c4dff", count: 1 },
  { id: "wcag", label: "WCAG", color: "#00897b", count: 2 },
];

export const CHECKLIST_CATEGORIES = [
  "All",
  "Accessibility",
  "Element_Button",
  "Element_Text field",
  "Navigation",
];

const seed = (
  row: Omit<ChecklistRow, "status" | "score">,
): ChecklistRow => ({ ...row, status: "untested", score: 0 });

/**
 * Only public, generic examples are shipped. Private/customer criteria must never
 * be committed to this public repository.
 */
export const DEFAULT_CHECKLIST_ROWS: ChecklistRow[] = [
  seed({
    id: "wcag-name-role-value",
    source: "wcag",
    category: "Accessibility",
    component: "Interactive controls",
    section: "Semantics",
    criterion: "Accessible name and role",
    expected: "Interactive controls expose an accessible name, role and state.",
    note: "Generic accessibility baseline.",
    tag: "req",
    type: "UX",
  }),
  seed({
    id: "wcag-keyboard",
    source: "wcag",
    category: "Accessibility",
    component: "Keyboard",
    section: "Input",
    criterion: "Keyboard operable",
    expected: "Interactive functionality is usable from a keyboard.",
    note: "Generic accessibility baseline.",
    tag: "req",
    type: "UX",
  }),
  seed({
    id: "ant-button-state",
    source: "ant",
    category: "Element_Button",
    component: "Button",
    section: "State",
    criterion: "Button state is clear",
    expected: "Disabled/loading/active states are visually distinguishable.",
    note: "Generic design-system example; verify against current public documentation.",
    tag: "opt",
    type: "UI",
  }),
  seed({
    id: "m3-text-field-label",
    source: "m3",
    category: "Element_Text field",
    component: "Text field",
    section: "Label",
    criterion: "Field purpose remains identifiable",
    expected: "The field keeps a persistent, understandable label or equivalent accessible name.",
    note: "Generic design-system example; verify against current public documentation.",
    tag: "opt",
    type: "UX",
  }),
];
