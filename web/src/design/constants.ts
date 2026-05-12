export const BA_TEMPLATE_CONTENT = `# DESIGN.md — Full Design System Handoff Template

> This file is read by AI coding agents (Claude Code, Cursor, Windsurf, Copilot).
> Fill in every section. The more detail you provide, the more accurate the generated code.

---

## 1. Project Overview

- **Product name**: [e.g. Acme SaaS]
- **Tech stack**: [e.g. React 18 + TypeScript + Tailwind CSS v4]
- **Target**: [e.g. Web app — desktop primary, mobile responsive]
- **Design system**: [e.g. Custom / shadcn/ui / Chakra UI / MUI]

---

## 2. Design Tokens

### 2.1 Color

| Token | Light mode | Dark mode | Purpose |
|-------|-----------|-----------|---------|
| --color-primary | #6366f1 | #818cf8 | Primary actions, links |
| --color-primary-hover | #4f46e5 | #6366f1 | Hover state |
| --color-surface | #ffffff | #0f172a | Page background |
| --color-surface-elevated | #f8fafc | #1e293b | Cards, panels |
| --color-surface-overlay | #f1f5f9 | #334155 | Hover rows, selected items |
| --color-border | #e2e8f0 | #334155 | Dividers, input borders |
| --color-border-focus | #6366f1 | #818cf8 | Focus rings |
| --color-text-primary | #0f172a | #f8fafc | Headings, labels |
| --color-text-secondary | #64748b | #94a3b8 | Descriptions, hints |
| --color-text-disabled | #cbd5e1 | #475569 | Disabled state |
| --color-success | #16a34a | #4ade80 | Success messages |
| --color-warning | #d97706 | #fbbf24 | Warning messages |
| --color-error | #dc2626 | #f87171 | Error messages, destructive |
| --color-info | #0284c7 | #38bdf8 | Informational messages |

### 2.2 Typography

| Token | Value | Usage |
|-------|-------|-------|
| --font-sans | Inter, system-ui, sans-serif | Body text |
| --font-mono | JetBrains Mono, monospace | Code blocks |
| --text-xs | 11px / 1.4 / 500 | Badges, captions |
| --text-sm | 13px / 1.5 / 400 | Labels, secondary text |
| --text-base | 14px / 1.6 / 400 | Body content |
| --text-md | 16px / 1.5 / 500 | Subheadings |
| --text-lg | 20px / 1.4 / 600 | Section headings |
| --text-xl | 24px / 1.3 / 700 | Page titles |
| --text-2xl | 32px / 1.2 / 700 | Hero headings |

### 2.3 Spacing (8px base scale)

| Token | Value | Usage |
|-------|-------|-------|
| --space-1 | 4px | Icon gaps, tight insets |
| --space-2 | 8px | Input padding, tight rows |
| --space-3 | 12px | Button padding, compact lists |
| --space-4 | 16px | Card padding, form rows |
| --space-6 | 24px | Section gaps |
| --space-8 | 32px | Large section padding |
| --space-12 | 48px | Page section spacing |
| --space-16 | 64px | Hero section padding |

### 2.4 Radius

| Token | Value | Usage |
|-------|-------|-------|
| --radius-sm | 4px | Badges, chips |
| --radius-md | 8px | Inputs, buttons |
| --radius-lg | 12px | Cards, panels |
| --radius-xl | 16px | Modals, drawers |
| --radius-full | 9999px | Pills, avatars |

### 2.5 Shadow

| Token | Value | Usage |
|-------|-------|-------|
| --shadow-xs | 0 1px 2px rgba(0,0,0,0.05) | Inputs |
| --shadow-sm | 0 1px 4px rgba(0,0,0,0.08) | Cards |
| --shadow-md | 0 4px 16px rgba(0,0,0,0.10) | Dropdowns, popovers |
| --shadow-lg | 0 12px 40px rgba(0,0,0,0.14) | Modals |

### 2.6 Motion

| Token | Value | Usage |
|-------|-------|-------|
| --duration-fast | 100ms | Micro interactions (color, opacity) |
| --duration-base | 200ms | Default transitions |
| --duration-slow | 350ms | Page transitions, modals |
| --ease-default | cubic-bezier(0.4, 0, 0.2, 1) | Standard easing |
| --ease-spring | cubic-bezier(0.34, 1.56, 0.64, 1) | Bounce/spring |
| --ease-out | cubic-bezier(0, 0, 0.2, 1) | Enter animations |

---

## 3. Component Library

### 3.1 Button

| Variant | States | Props |
|---------|--------|-------|
| primary | default / hover / focus / active / disabled / loading | size: sm|md|lg, leftIcon, rightIcon, fullWidth |
| secondary | same as above | — |
| ghost | same as above | — |
| destructive | same as above | — |
| link | default / hover / visited | — |

> Note: Loading state replaces label with spinner. Disabled has opacity 0.5 and cursor not-allowed.

### 3.2 Input / Form

| Component | Variants | Key Props |
|-----------|---------|-----------|
| TextInput | default / focus / error / disabled / readonly | label, helperText, errorText, leftAddon, rightAddon |
| Textarea | same | rows, resize, autoGrow |
| Select | default / open / error / disabled | options, searchable, multi |
| Checkbox | unchecked / checked / indeterminate / disabled | label, description |
| Radio | unselected / selected / disabled | label, description |
| Toggle/Switch | off / on / disabled | label |
| DatePicker | closed / open / range | minDate, maxDate |
| FileUpload | idle / drag-over / uploading / success / error | accept, maxSize, multiple |

### 3.3 Feedback

| Component | Variants |
|-----------|---------|
| Alert | info / success / warning / error — with/without dismiss |
| Toast | same variants — position: top-right | bottom-center |
| Skeleton | text | card | avatar | table |
| Spinner | sm | md | lg, color inherits |
| EmptyState | icon + title + description + CTA |
| ErrorState | 404 | 500 | offline | forbidden |

### 3.4 Navigation

| Component | Notes |
|-----------|-------|
| TopNav | logo + nav links + user menu + mobile hamburger |
| Sidebar | collapsible, active-link highlight, nested groups |
| Breadcrumb | auto-truncate on mobile |
| Tabs | underline | pill variants, keyboard arrow-key nav |
| Pagination | page numbers + prev/next + page-size selector |

### 3.5 Data Display

| Component | Notes |
|-----------|-------|
| Table | sortable headers, row selection, sticky header, responsive scroll |
| DataGrid | virtualised rows, column resize, row actions |
| Card | header + body + footer, clickable variant |
| Badge | color variants, dot variant |
| Avatar | image / initials / fallback icon, size variants |
| Tag/Chip | dismissible, clickable |
| Tooltip | top/right/bottom/left, delay 400ms, max-width 240px |

### 3.6 Overlay

| Component | Notes |
|-----------|-------|
| Modal | sm / md / lg / fullscreen, trap focus, close on Escape |
| Drawer | left / right / bottom, overlay |
| Popover | trigger-based, close on outside click |
| ContextMenu | right-click triggered, keyboard nav |

---

## 4. Layout Patterns

### 4.1 Breakpoints

| Name | Width | Behaviour |
|------|-------|-----------|
| mobile | 0–767px | Single column, bottom nav |
| tablet | 768–1023px | 2 cols, collapsible sidebar |
| desktop | 1024–1279px | Sidebar + main, full nav |
| wide | 1280px+ | Max-width container (1200px centred) |

### 4.2 Grid

- 12-column grid, 16px gutter (mobile: 8px gutter)
- Layout template: \`[sidebar 240px] [main 1fr]\` on desktop
- Full-bleed hero sections bypass the grid

---

## 5. Screen Specifications

<!-- Copy this block for each screen -->

## Screen: [Screen Name]

### Purpose
[One sentence: what the user achieves here]

### Layout
- Grid: [columns]
- Nav: [top | left | none]
- Breakpoints: mobile 375px | tablet 768px | desktop 1280px
- Key regions: [list]

### Components
| Component | Variant | Props | State |
|-----------|---------|-------|-------|
| — | — | — | default / hover / loading / error / empty |

### Typography
| Role | Token | Notes |
|------|-------|-------|
| Page title | --text-xl | — |
| Section heading | --text-lg | — |
| Body | --text-base | — |
| Label | --text-sm | — |

### Color tokens
| Token | Purpose |
|-------|---------|
| --color-primary | CTA buttons |
| --color-surface-elevated | Card backgrounds |

### Spacing
- [Specific spacing rules for this screen]

### Motion
- Enter: fade-up 200ms ease-out
- Exit: fade 150ms ease-in
- Micro: color / opacity 100ms

### Accessibility
- ARIA roles: main, navigation, button, dialog
- Keyboard: Tab to next focusable, Enter/Space to activate, Escape to close
- WCAG 2.1 AA: 4.5:1 contrast on text, 3:1 on UI components

### Interactions
- [User flow steps]
- Loading state: skeleton while fetching
- Empty state: EmptyState component with CTA
- Error state: Alert with retry action

---

## 6. Agent Instructions

> Note: Follow the token names exactly — do not invent new CSS variables.
> Note: All interactive elements must have visible focus rings using --color-border-focus.
> Note: Support both light and dark mode using the token table in section 2.1.
> Note: Use --duration-base for all hover/focus transitions unless noted otherwise.
> Note: [Add project-specific constraints here]
`;

export const SCREEN_NAMES = ["Login", "Dashboard", "Detail", "Form", "Settings"] as const;
export type ScreenName = typeof SCREEN_NAMES[number];
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_CONTEXT_PROMPT_LENGTH = 10000;
export const DEBOUNCE_MS = 300;
export const AUTOSAVE_INTERVAL_MS = 30000;
export const WS_TIMEOUT_MS = 12000;
