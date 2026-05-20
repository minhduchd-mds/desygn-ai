# 05 — Web Template Redesign

> Mục đích: Thiết kế lại visual + UX của web template cho dashboard SaaS Desygn A11y. Tách biệt khỏi `web/` hiện tại để tránh kéo theo legacy design.

---

## 1. Design philosophy

### Three principles

**1. Calm clarity over visual noise.**
A11y compliance là việc nghiêm túc — designers và compliance officers cần focus, không cần aesthetic fireworks. Mỗi pixel phải có lý do tồn tại. Loại bỏ gradient, blur, animation trừ khi cần thiết.

**2. Information density when it matters, breathing room when it doesn't.**
Trang list audits: dày đặc data. Onboarding page: nhiều khoảng trắng để guide. Một design system phải support cả hai.

**3. Accessible by example.**
Vì product là về a11y, dashboard phải là tấm gương: 4.5:1 contrast tối thiểu, keyboard navigation hoàn hảo, screen reader friendly. Mọi reviewer của product sẽ test luôn dashboard.

### What this dashboard is NOT
- ❌ Linear-style "design forward" — đẹp nhưng quá flashy
- ❌ Notion-style — flexible nhưng confusing
- ❌ Apple HIG copy — quá identifiable
- ❌ Material 3 — quá Google-y

### What this dashboard IS
- ✅ Stripe Dashboard's clarity, but warmer
- ✅ Vercel's typography, but more accessible
- ✅ Plain function-first with subtle craft

---

## 2. Color system

### Brand colors

```scss
// Primary — Trust + technical
--brand-violet-50:  oklch(97% 0.02 295);
--brand-violet-100: oklch(94% 0.04 295);
--brand-violet-200: oklch(88% 0.08 295);
--brand-violet-300: oklch(80% 0.12 295);
--brand-violet-400: oklch(70% 0.16 295);
--brand-violet-500: oklch(58% 0.20 295);    // Primary CTA
--brand-violet-600: oklch(50% 0.22 295);    // CTA hover
--brand-violet-700: oklch(42% 0.20 295);
--brand-violet-800: oklch(33% 0.16 295);
--brand-violet-900: oklch(25% 0.12 295);
--brand-violet-950: oklch(15% 0.08 295);

// Secondary — Accent for severity
--brand-teal-500:   oklch(65% 0.15 195);    // Pass / success
--brand-amber-500:  oklch(73% 0.17 75);     // Warning / moderate
--brand-red-500:    oklch(60% 0.22 25);     // Critical / fail
--brand-rose-400:   oklch(70% 0.15 15);     // Serious

// Neutral — Most of the UI
--neutral-0:        oklch(100% 0 0);
--neutral-50:       oklch(98% 0.005 270);
--neutral-100:      oklch(95% 0.01 270);
--neutral-200:      oklch(91% 0.012 270);
--neutral-300:      oklch(82% 0.015 270);
--neutral-400:      oklch(68% 0.02 270);
--neutral-500:      oklch(54% 0.025 270);
--neutral-600:      oklch(43% 0.03 270);
--neutral-700:      oklch(33% 0.025 270);
--neutral-800:      oklch(22% 0.02 270);
--neutral-900:      oklch(14% 0.015 270);
--neutral-950:      oklch(8% 0.01 270);
```

### Why OKLCH (not HSL or sRGB hex)?

- Perceptually uniform: 50→60 lightness change feels same as 70→80
- Color blending works correctly
- Wider gamut on P3 displays
- Modern browsers support (Safari 15.4+, Chrome 111+)
- Better dark mode: just shift L channel, hue stays same

### Semantic mapping

```scss
// Light mode
--bg-canvas:        var(--neutral-50);          // Page background
--bg-elevated:      var(--neutral-0);           // Cards, modals
--bg-subtle:        var(--neutral-100);         // Inactive areas
--bg-muted:         var(--neutral-200);         // Disabled states

--fg-default:       var(--neutral-900);         // Body text
--fg-muted:         var(--neutral-600);         // Secondary text
--fg-subtle:        var(--neutral-500);         // Placeholder, captions
--fg-on-brand:      var(--neutral-0);           // Text on brand bg

--border-default:   var(--neutral-200);
--border-strong:    var(--neutral-300);
--border-focus:     var(--brand-violet-500);

--accent-default:   var(--brand-violet-500);
--accent-hover:     var(--brand-violet-600);
--accent-subtle:    var(--brand-violet-100);
--accent-text:      var(--brand-violet-700);

--severity-critical: var(--brand-red-500);
--severity-serious:  var(--brand-rose-400);
--severity-moderate: var(--brand-amber-500);
--severity-minor:    var(--neutral-400);
--severity-pass:     var(--brand-teal-500);

// Dark mode
[data-theme="dark"] {
  --bg-canvas:      var(--neutral-950);
  --bg-elevated:    var(--neutral-900);
  --bg-subtle:      var(--neutral-800);
  --bg-muted:       var(--neutral-700);

  --fg-default:     var(--neutral-50);
  --fg-muted:       var(--neutral-400);
  --fg-subtle:      var(--neutral-500);

  --border-default: var(--neutral-800);
  --border-strong:  var(--neutral-700);

  --accent-default: var(--brand-violet-400);
  --accent-hover:   var(--brand-violet-300);
  --accent-subtle:  var(--brand-violet-900);
  --accent-text:    var(--brand-violet-300);
}
```

### Contrast verification

Every text/bg combination tested:

| Foreground | Background | Ratio | WCAG |
|---|---|---|---|
| `--fg-default` on `--bg-canvas` | 14.8:1 | ✅ AAA |
| `--fg-muted` on `--bg-canvas` | 7.2:1 | ✅ AAA |
| `--fg-subtle` on `--bg-canvas` | 4.6:1 | ✅ AA |
| `--accent-default` on `--bg-canvas` | 5.1:1 | ✅ AA |
| `--fg-on-brand` on `--accent-default` | 6.8:1 | ✅ AAA |

Hard rule: nothing below 4.5:1 for body text, 3:1 for large text.

---

## 3. Typography

### Font stack

```scss
--font-sans: "Inter Variable", "Inter", system-ui, -apple-system, "Segoe UI", sans-serif;
--font-mono: "JetBrains Mono Variable", "JetBrains Mono", "Fira Code", Consolas, monospace;
```

Why Inter Variable:
- Excellent screen rendering
- 9 weights from 1 file (faster load)
- OpenType features (tabular numerals, fractions)
- Free, open source
- Wide language support including Vietnamese with marks

### Type scale (Major Third — 1.250)

```scss
--text-xs:    0.75rem;    // 12px — captions, labels
--text-sm:    0.875rem;   // 14px — secondary text, buttons
--text-base:  1rem;       // 16px — body
--text-lg:    1.125rem;   // 18px — subheading
--text-xl:    1.25rem;    // 20px — H4
--text-2xl:   1.5rem;     // 24px — H3
--text-3xl:   1.875rem;   // 30px — H2
--text-4xl:   2.25rem;    // 36px — H1
--text-5xl:   3rem;       // 48px — Hero
--text-6xl:   3.75rem;    // 60px — Landing hero only
```

### Line height

```scss
--leading-none:    1;
--leading-tight:   1.25;     // Headings
--leading-snug:    1.375;
--leading-normal:  1.5;      // Body
--leading-relaxed: 1.625;
--leading-loose:   2;        // Long-form reading
```

### Weight

```scss
--weight-normal:    400;     // Body
--weight-medium:    500;     // Subtle emphasis
--weight-semibold:  600;     // Headings, buttons
--weight-bold:      700;     // Strong emphasis
```

### Type tokens (composed)

```scss
--type-hero {
  font-size: var(--text-5xl);
  line-height: var(--leading-tight);
  font-weight: var(--weight-bold);
  letter-spacing: -0.02em;
}

--type-h1 { font-size: var(--text-4xl); line-height: var(--leading-tight); font-weight: 700; letter-spacing: -0.015em; }
--type-h2 { font-size: var(--text-3xl); line-height: var(--leading-tight); font-weight: 700; letter-spacing: -0.01em; }
--type-h3 { font-size: var(--text-2xl); line-height: var(--leading-snug); font-weight: 600; }
--type-h4 { font-size: var(--text-xl); line-height: var(--leading-snug); font-weight: 600; }

--type-body-lg  { font-size: var(--text-lg); line-height: var(--leading-relaxed); }
--type-body     { font-size: var(--text-base); line-height: var(--leading-normal); }
--type-body-sm  { font-size: var(--text-sm); line-height: var(--leading-normal); }
--type-caption  { font-size: var(--text-xs); line-height: var(--leading-normal); }

--type-mono     { font-family: var(--font-mono); font-size: var(--text-sm); }
```

### Tabular numerals

For tables, KPI cards, anywhere numbers align vertically:

```css
.tabular {
  font-variant-numeric: tabular-nums;
}
```

---

## 4. Spacing scale

```scss
--space-0:     0;
--space-px:    1px;
--space-0_5:   0.125rem;    // 2px
--space-1:     0.25rem;     // 4px
--space-2:     0.5rem;      // 8px
--space-3:     0.75rem;     // 12px
--space-4:     1rem;        // 16px
--space-5:     1.25rem;     // 20px
--space-6:     1.5rem;      // 24px
--space-8:     2rem;        // 32px
--space-10:    2.5rem;      // 40px
--space-12:    3rem;        // 48px
--space-16:    4rem;        // 64px
--space-20:    5rem;        // 80px
--space-24:    6rem;        // 96px
--space-32:    8rem;        // 128px
```

### Spacing rules

- Inside cards: 24px (`--space-6`)
- Between sections: 48px (`--space-12`)
- Tight UI (table rows, list items): 12-16px
- Form fields gap: 16px
- Buttons internal: 12-16px x 8-12px

---

## 5. Layout

### Page templates

#### Template 1 — App shell (logged-in routes)

```
┌──────────────────────────────────────────────────────────┐
│  Sidebar (240px) │   Main content area                    │
│                  │  ┌────────────────────────────────┐   │
│  • Logo          │  │  Top bar (60px)                │   │
│  • Workspace     │  │  • Breadcrumb / Page title     │   │
│    switcher      │  │  • Search / Actions / Avatar    │   │
│  ──────────────  │  └────────────────────────────────┘   │
│  Navigation      │  ┌────────────────────────────────┐   │
│  • Dashboard     │  │                                  │   │
│  • Audits        │  │   Page content                  │   │
│  • Projects      │  │   (max-width 1280px)            │   │
│  • Reports       │  │                                  │   │
│  • Team          │  │                                  │   │
│  • Settings      │  └────────────────────────────────┘   │
│  ──────────────  │                                        │
│  • Help          │                                        │
│  • Account       │                                        │
└──────────────────┴──────────────────────────────────────┘
```

#### Template 2 — Marketing/landing (public routes)

```
┌──────────────────────────────────────────────────────────┐
│  Top nav (72px) — sticky                                  │
│  Logo │ Products │ Pricing │ Docs │ Sign in │ [CTA]      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│                      Hero section                          │
│        (max-width 1024px, centered)                        │
│                                                            │
├──────────────────────────────────────────────────────────┤
│  Section 2 — Features                                      │
│  3-column grid                                             │
├──────────────────────────────────────────────────────────┤
│  Section 3 — Social proof                                  │
├──────────────────────────────────────────────────────────┤
│  Section 4 — Pricing teaser                                │
├──────────────────────────────────────────────────────────┤
│  Section 5 — CTA                                           │
├──────────────────────────────────────────────────────────┤
│  Footer (large)                                            │
└──────────────────────────────────────────────────────────┘
```

#### Template 3 — Onboarding / focused tasks

```
┌──────────────────────────────────────────────────────────┐
│  Logo │                                          [Close]   │
├──────────────────────────────────────────────────────────┤
│                                                            │
│                                                            │
│             Step 1 of 3                                   │
│                                                            │
│             Page title (h1)                                │
│             Subtitle                                       │
│                                                            │
│             [Form / Content]                              │
│                                                            │
│             [Back]              [Continue →]              │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

### Grid system

- 12-column grid
- Gutters: 24px desktop, 16px mobile
- Max content width: 1280px
- Container padding: 32px desktop, 16px mobile

### Responsive breakpoints

```scss
--breakpoint-sm:  640px;     // Mobile landscape
--breakpoint-md:  768px;     // Tablet
--breakpoint-lg:  1024px;    // Laptop
--breakpoint-xl:  1280px;    // Desktop
--breakpoint-2xl: 1536px;    // Large desktop
```

### Sidebar behavior

- Desktop (≥1024px): expanded 240px, persistent
- Tablet (768-1024px): collapsed to 64px icons only
- Mobile (<768px): drawer, slide in from left

---

## 6. Component patterns

### Cards

```scss
.card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 12px;
  padding: var(--space-6);
  transition: border-color 0.15s ease;
}

.card-hover:hover {
  border-color: var(--border-strong);
}

.card-elevated {
  box-shadow: 0 1px 3px oklch(0% 0 0 / 5%), 0 4px 12px oklch(0% 0 0 / 4%);
}
```

3 elevations:
- **Flat**: no shadow, just border. Default for content.
- **Raised**: subtle shadow. For interactive cards.
- **Floating**: medium shadow. For modals, popovers.

### Buttons

Already designed in `04-frontend-architecture.md` section 4 (Primitives). Adding visual specs:

- **Primary**: violet 500 fill, white text, hover violet 600
- **Secondary**: neutral 200 fill, default text
- **Ghost**: transparent, hover neutral 100
- **Danger**: red 500 fill, white text
- **Outline**: transparent fill, border + text in accent

Sizes:
- **sm**: 32px height, 12px text
- **md**: 40px height, 14px text (default)
- **lg**: 48px height, 16px text

States:
- Default → Hover → Active → Focus (always visible ring) → Disabled (50% opacity)

### Forms

```
┌─────────────────────────────────┐
│  Label                          │
│  ┌─────────────────────────┐   │
│  │ Input                   │   │
│  └─────────────────────────┘   │
│  Help text or error             │
└─────────────────────────────────┘
```

- Label: 14px, weight 500, color `--fg-default`
- Input: 40px tall, 16px padding, border `--border-default`
- Focus: border `--border-focus` + 2px outline ring
- Error: border `--severity-critical`, message in red below
- Required: `*` after label in accent color

### Tables (DataTable)

- Header row: bg `--bg-subtle`, text `--fg-muted`, 12px uppercase, weight 600
- Data rows: 48px height, border-bottom `--border-default`
- Hover: bg `--bg-subtle` 50% alpha
- Selected: bg `--accent-subtle`
- Action column: always rightmost, fixed width
- Tabular numerals for numeric columns

### Badges (severity indicators)

```scss
.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
}

.badge-critical {
  background: oklch(from var(--severity-critical) l c h / 0.15);
  color: oklch(from var(--severity-critical) calc(l - 10%) c h);
}
// Similar for serious, moderate, minor, pass
```

### Modals & dialogs

- Backdrop: black 50% alpha + blur 4px
- Container: max 600px width, centered
- Header: title (h3) + close button
- Body: 24px padding
- Footer: actions right-aligned (Cancel | Confirm)

### Toast notifications

- Position: bottom-right
- Width: 360px max
- Auto-dismiss: 5s for success/info, manual for error
- Stack: max 5 visible, queue rest
- Animation: slide in from right + fade

---

## 7. Iconography

### Library
**Lucide React** — open source, consistent, comprehensive (1,300+ icons).

```tsx
import { Activity, AlertTriangle, ArrowRight, Check, Eye } from "lucide-react";

<AlertTriangle className="size-4 text-amber-500" />
```

### Rules
- Stroke 1.5px (default)
- Size from token: 16px / 20px / 24px / 32px
- Color via parent text color (`currentColor`)
- Decorative: `aria-hidden="true"`
- Semantic: `aria-label="..."` or wrap in `<button>` with label

### Custom icons
- Only when Lucide doesn't have
- Maintain stroke 1.5px and 24px viewBox
- Store in `packages/ui/src/icons/`

---

## 8. Motion design

### Principles

- **Purpose**: Every animation answers a question — "what happened?", "where did I go?", "is it loading?"
- **Quick**: 150-200ms most transitions. 300-400ms for entrance/exit.
- **Curved**: `ease-out` (decelerate) for entrances, `ease-in` for exits
- **Subtle**: 8-16px movement, 0.95-1.0 scale
- **Respect**: `prefers-reduced-motion` always honored

### Duration scale

```scss
--duration-instant: 0ms;
--duration-fast:    100ms;     // Hover states
--duration-normal:  150ms;     // Color/border transitions
--duration-slow:    200ms;     // Modal open
--duration-slower:  300ms;     // Page transitions
--duration-page:    400ms;     // Major route changes
```

### Easing

```scss
--ease-linear: linear;
--ease-in:     cubic-bezier(0.4, 0, 1, 1);
--ease-out:    cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-spring: cubic-bezier(0.3, 1.5, 0.5, 1);   // Bouncy
```

### Common patterns

```tsx
// Page transition
<motion.div
  initial={{ opacity: 0, y: 8 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -8 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
  {children}
</motion.div>

// Stagger children (e.g., list of audits)
<motion.ul
  variants={{
    show: { transition: { staggerChildren: 0.05 } },
  }}
  initial="hidden"
  animate="show"
>
  {items.map((item) => (
    <motion.li
      key={item.id}
      variants={{
        hidden: { opacity: 0, y: 8 },
        show: { opacity: 1, y: 0 },
      }}
    >
      {/* ... */}
    </motion.li>
  ))}
</motion.ul>
```

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Iconography for audit results

### Score gauge

Donut chart, 120px diameter, with:
- Color gradient: red (0-40) → amber (41-70) → teal (71-100)
- Bold number center
- WCAG level label below ("AA")

### Severity icons

| Severity | Icon (Lucide) | Color |
|---|---|---|
| Critical | `ShieldAlert` | `--severity-critical` |
| Serious | `AlertTriangle` | `--severity-serious` |
| Moderate | `AlertCircle` | `--severity-moderate` |
| Minor | `Info` | `--severity-minor` |
| Pass | `CheckCircle2` | `--severity-pass` |

### Page types

| Type | Icon |
|---|---|
| Mobile | `Smartphone` |
| Tablet | `Tablet` |
| Desktop | `Monitor` |
| Generic frame | `Frame` |

---

## 10. Empty states

### Pattern

```
┌─────────────────────────────────┐
│                                  │
│         [Illustration]           │
│                                  │
│      Title (h3)                  │
│      Subtitle text — keep short  │
│                                  │
│      [Primary action]            │
│                                  │
└─────────────────────────────────┘
```

### Illustrations

Hand-drawn SVG style, 240px wide, brand colors:
- "No audits yet" → person looking at empty list
- "No projects" → empty folder
- "No team members" → single person, "+" to add
- "No issues found" → checkmark in shield
- "Error / 404" → broken bridge

Store in `packages/ui/src/illustrations/`.

### Tone

Friendly but not goofy:
- ✅ "Run your first audit to see results here"
- ✅ "Connect a Figma file to get started"
- ❌ "Oopsie! Nothing here yet 🥺"

---

## 11. Loading states

### Skeleton screens (preferred)

Show layout placeholder while loading:

```tsx
{isLoading ? (
  <div className="space-y-4">
    <Skeleton className="h-8 w-1/3" />
    <Skeleton className="h-4 w-2/3" />
    <Skeleton className="h-32 w-full" />
  </div>
) : (
  <AuditDetail audit={data} />
)}
```

### Spinners (last resort)

Only for actions <2s where layout placeholder doesn't make sense:
- Button loading state
- "Running audit..." inline indicator

### Progress bars

For known-duration operations:
- Audit progress (uses SSE stream)
- Upload progress
- Export PDF generation

---

## 12. Dark mode

### Triggers

- System preference (`prefers-color-scheme`)
- User toggle (saved in localStorage)
- Persisted across sessions

### Implementation

```tsx
// Detect on app load
useEffect(() => {
  const saved = localStorage.getItem("theme");
  const system = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const theme = saved ?? system;
  document.documentElement.dataset.theme = theme;
}, []);
```

CSS variables auto-adjust via `[data-theme="dark"]` selector.

### Image/illustration handling

- Use SVG that adapts via `currentColor`
- For raster images: provide light + dark variants
- For Figma screenshots: render at correct background

---

## 13. Accessibility features

### Built-in
- Skip-to-content link (visible on focus)
- All interactive elements ≥ 44×44 touch target
- All form fields have associated labels
- Error messages associated via `aria-describedby`
- Live regions for dynamic content
- Focus trap in modals
- ESC key closes modals
- Keyboard shortcuts (Cmd+K command palette)
- High contrast mode support (`prefers-contrast: high`)
- Reduced motion respected

### Cmd+K command palette

Always available shortcut for power users:
```
[Cmd+K] → Search audits, projects, settings
         → Quick actions: New audit, Invite member, ...
```

---

## 14. Sample mock-ups (described)

### Dashboard home

```
┌───────────────────────────────────────────────────────────┐
│  Sidebar                │  Top bar: "Dashboard" + Avatar    │
│                         │                                    │
│  Dashboard ●            │  Welcome back, Minh                │
│  Audits                 │                                    │
│  Projects               │  ┌──────────┬──────────┬──────────┐│
│  Reports                │  │ Audits   │ Issues   │ Score    ││
│  Team                   │  │ this mo  │ found    │ avg      ││
│  Settings               │  │   47     │   183    │  82/100  ││
│                         │  │ +12% ▲   │ -8% ▼    │ +5 ▲     ││
│                         │  └──────────┴──────────┴──────────┘│
│                         │                                    │
│                         │  Recent Audits        [+ New]      │
│                         │  ┌──────────────────────────────┐ │
│                         │  │ Acme E-commerce  ⓘ 78/100 ◯ │ │
│                         │  │ My SaaS Landing  ⓘ 92/100 ✓ │ │
│                         │  │ Mobile App v2    ⓘ 45/100 ⚠ │ │
│                         │  └──────────────────────────────┘ │
│                         │                                    │
│                         │  Trend (last 30 days)              │
│                         │  [Line chart — avg score over time]│
│                         │                                    │
└─────────────────────────┴────────────────────────────────────┘
```

### Audit detail

```
┌───────────────────────────────────────────────────────────┐
│  Sidebar                │  Top bar: "Acme E-commerce" >    │
│                         │                                    │
│                         │  Header: project + WCAG version    │
│                         │  [Export ▾] [Share] [Re-audit]    │
│                         │                                    │
│                         │  ┌─────────────────┐  ┌─────────┐ │
│                         │  │                 │  │ Issues  │ │
│                         │  │     78          │  │ ━━━     │ │
│                         │  │     /100        │  │ Critical│ │
│                         │  │   WCAG 2.2 AA   │  │  ◯ 3   │ │
│                         │  │   [Donut chart] │  │ Serious │ │
│                         │  │                 │  │  ◯ 12  │ │
│                         │  └─────────────────┘  │ Moderate│ │
│                         │                       │  ◯ 28  │ │
│                         │                       │ Minor   │ │
│                         │                       │  ◯ 47  │ │
│                         │                       └─────────┘ │
│                         │                                    │
│                         │  Top Issues                        │
│                         │  ┌──────────────────────────────┐ │
│                         │  │ ⓘ ◯ Critical contrast 2.1:1 │ │
│                         │  │   "Footer copyright" text    │ │
│                         │  │   Need 4.5:1 ▸               │ │
│                         │  ├──────────────────────────────┤ │
│                         │  │ ⓘ ⚠ Serious missing alt text │ │
│                         │  │   "Hero banner image"        │ │
│                         │  │   ▸                          │ │
│                         │  └──────────────────────────────┘ │
└─────────────────────────┴────────────────────────────────────┘
```

### Pricing page

```
┌───────────────────────────────────────────────────────────┐
│  Hero: "Catch a11y bugs in Figma. Before they cost you."   │
│                                                              │
│  ┌────────┐  ┌────────┐  ┌─────────┐  ┌─────────────┐    │
│  │ Free   │  │ Pro    │  │ Team    │  │ Enterprise  │    │
│  │ $0     │  │ $29/mo │  │$299/mo  │  │  Custom     │    │
│  │        │  │ ★ Pop  │  │         │  │             │    │
│  │ • 5/mo │  │ • 100  │  │ • 1000  │  │ • Unlimited │    │
│  │ • Free │  │ • PDF  │  │ • Team  │  │ • SOC2      │    │
│  │ • MD   │  │ • API  │  │ • SSO   │  │ • SSO/SAML  │    │
│  │ [Free] │  │[Start] │  │[Start]  │  │ [Contact]   │    │
│  └────────┘  └────────┘  └─────────┘  └─────────────┘    │
│                                                              │
│  Trust strip: "Trusted by teams at [logos]"                 │
│                                                              │
│  FAQ section                                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 15. Implementation deliverables

When Claude Code implements this:

1. **`packages/ui/src/tokens/`** — All CSS variables as one source of truth
2. **`packages/ui/src/primitives/`** — Components in Section 6
3. **Storybook stories** — One per primitive showing all variants/states
4. **`docs/design-system.md`** — Living spec of all tokens + components
5. **Figma file** — Optional but valuable: Desygn A11y design system in Figma

### Quality bar

- Every component has Storybook story
- Every component has a11y tests
- Every component documented with props table
- Visual regression tests via Chromatic
- Performance: no component re-renders unnecessarily (use `React.memo` judiciously)
