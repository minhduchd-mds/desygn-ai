# @desygn/ui

Shared design system for Desygn A11y apps: OKLCH design tokens + accessible,
dependency-free React primitives.

## Install

```bash
npm install @desygn/ui
```

## Setup

Import the CSS once at your app root (tokens first, then primitives):

```ts
import "@desygn/ui/tokens.css";
import "@desygn/ui/primitives.css";
```

Toggle dark mode with the `data-theme` attribute on `<html>`:

```html
<html data-theme="dark">
```

## Primitives (8)

```tsx
import { Button, Input, Card, Badge, Spinner, Checkbox, Switch, Avatar } from "@desygn/ui";

<Button variant="primary" size="md" loading={false}>Start audit</Button>
<Input error="Enter a valid URL" />
<Card variant="elevated">…</Card>
<Badge tone="error">Critical</Badge>
<Spinner size="md" />
<Checkbox label="Include AAA checks" />
<Switch label="Block PR on fail" />
<Avatar name="Minh Duc" src={url} />
```

All primitives ship a visible focus ring (WCAG 2.4.7) and honor
`prefers-reduced-motion`.

## Tokens

```ts
import { colors, spacing, radius, fontSize, motion } from "@desygn/ui";
```

Colors use the **OKLCH** color space for perceptual uniformity (better
contrast behavior than HSL/RGB).

## Design notes

- No Radix / Tailwind / CVA — plain React + a single shipped stylesheet,
  matching the existing repo convention (CSS per component)
- Styling logic lives in pure `*Class()` builders (`variants.ts`), unit-
  tested without a DOM
- `severityToTone()` maps audit severities → badge tones for the dashboard

## License

MIT
