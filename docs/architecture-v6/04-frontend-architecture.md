# 04 — Frontend Architecture

## 1. Overall structure

Frontend Desygn A11y là một **dashboard SaaS** mới, mount tại `a11y.desygn.ai`. Tách riêng khỏi `web/` hiện tại (workspace cho Design.md).

### Why separate app
- Workspace hiện tại (`web/src/`) tập trung Design.md generation
- A11y dashboard có audience khác, journey khác, branding khác
- Build size sẽ nhỏ hơn → load nhanh hơn
- Routes không xung đột
- Có thể deploy độc lập

### Structure

```
Design-md-ai-main/
├── apps/                              # NEW workspace
│   ├── a11y-dashboard/                # NEW — main SaaS
│   │   ├── src/
│   │   │   ├── routes/                # File-based routing
│   │   │   ├── components/
│   │   │   ├── features/              # Feature modules
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   ├── styles/
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── marketing/                     # NEW — landing page
│       ├── src/
│       │   ├── routes/
│       │   ├── components/
│       │   └── content/
│       └── package.json
├── packages/                          # Shared
│   ├── ui/                            # NEW — design system components
│   │   ├── src/
│   │   │   ├── primitives/            # Button, Input, etc.
│   │   │   ├── patterns/              # Form, Modal, Toast
│   │   │   └── tokens/                # Design tokens
│   │   └── package.json
│   └── ...
└── web/                               # EXISTING — keep
```

---

## 2. Tech stack quyết định

### Core
- **Framework:** React 19 (đã dùng) + **TanStack Start** (file-based routing + SSR)
- **Build:** Vite 6 (đã dùng)
- **Language:** TypeScript 5.7 strict mode
- **Package manager:** pnpm (đã có workspace config)

### Tại sao TanStack Start (không phải Next.js)?
- Native React 19 support
- File-based routing tốt hơn React Router
- Built-in data loaders với typed routes
- SSR tốt hơn để SEO marketing page
- Không cần migrate khỏi Vite (Next.js bắt buộc Turbopack/Webpack)
- Bundle size nhỏ hơn Next.js

### State management
- **Server state:** TanStack Query v5 (đã quen pattern)
- **Client state:** Zustand cho global, useState cho local
- **Form state:** React Hook Form + Zod
- **URL state:** TanStack Router search params

### Styling
- **CSS:** Tailwind CSS v4 + CSS Modules cho component-specific
- **Tokens:** Design tokens exported as CSS variables
- **Theming:** Dark/light mode via `data-theme` attribute
- **Animation:** Framer Motion cho complex, CSS cho simple

### Component library
- **Headless:** Radix UI primitives (Dialog, Dropdown, Toast, etc.)
- **Styled:** Custom design system in `packages/ui`
- **Charts:** Recharts (đã dùng trong main app)
- **Tables:** TanStack Table v8
- **Date:** Temporal API polyfill, or date-fns

### Data fetching
- **REST:** Generated client từ OpenAPI spec (via `openapi-typescript`)
- **Auth:** Supabase Auth helpers cho React
- **Real-time:** Supabase Realtime cho audit progress
- **SSE:** Native EventSource cho audit stream

### Testing
- **Unit:** Vitest (đã dùng)
- **Component:** Testing Library
- **E2E:** Playwright (đã dùng)
- **Visual:** Chromatic (Storybook integration)

### Observability
- **Errors:** Sentry React SDK
- **Analytics:** PostHog
- **Performance:** Web Vitals → PostHog
- **Replays:** PostHog Session Replay (privacy-safe)

---

## 3. Routes & page structure

### Public routes
```
/                              # Landing page
/pricing                       # Pricing page
/customers                     # Case studies
/blog                          # Blog posts
/blog/[slug]
/docs                          # Documentation
/docs/[...path]
/about                         # About + team
/legal/terms
/legal/privacy
/legal/dpa
/verify                        # PDF verification
/login                         # Auth entry
/signup
/forgot-password
/reset-password
```

### App routes (auth required)
```
/dashboard                     # Overview
/audits                        # Audit list
/audits/new                    # Start new audit
/audits/[id]                   # Audit detail
/audits/[id]/report            # Full report view
/audits/[id]/issues            # Issues list
/audits/[id]/issues/[issueId]  # Issue detail
/projects                      # Project management
/projects/[id]
/projects/[id]/settings
/projects/[id]/integrations    # GitHub Action, Slack
/team                          # Team mgmt (Team+ tier)
/team/members
/team/billing
/team/sso                      # Enterprise only
/team/api-keys
/settings                      # User settings
/settings/profile
/settings/notifications
/settings/api-keys             # Personal API keys (Pro+ tier)
/settings/security
/billing                       # Personal billing
/help                          # Help center embedded
```

### Routes file structure (TanStack Start)
```
src/routes/
├── __root.tsx                 # Root layout
├── _public/                   # Public layout group
│   ├── route.tsx
│   ├── index.tsx              # /
│   ├── pricing.tsx
│   └── ...
├── _auth/                     # Auth layout group
│   ├── route.tsx
│   ├── login.tsx
│   └── signup.tsx
├── _app/                      # App layout group (sidebar nav)
│   ├── route.tsx              # Authenticated layout
│   ├── dashboard.tsx
│   ├── audits/
│   │   ├── route.tsx
│   │   ├── index.tsx
│   │   ├── new.tsx
│   │   └── $id/
│   │       ├── route.tsx
│   │       ├── index.tsx
│   │       ├── report.tsx
│   │       └── issues.tsx
│   └── ...
```

---

## 4. Component architecture

### Layer 1 — Primitives (`packages/ui/src/primitives`)

Headless components built on Radix UI:

```tsx
// packages/ui/src/primitives/Button.tsx
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva(
  // Base styles
  "inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-500",
        secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-100",
        ghost: "hover:bg-slate-100 dark:hover:bg-slate-800",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  }
);
```

Primitives needed:
- Button, IconButton
- Input, Textarea, Select, Checkbox, Radio, Switch
- Card, Panel
- Dialog, Drawer, Popover, Tooltip
- DropdownMenu, ContextMenu
- Tabs, Accordion
- Toast (Sonner)
- Skeleton, Spinner
- Avatar, Badge
- Separator
- ScrollArea

### Layer 2 — Patterns (`packages/ui/src/patterns`)

Composed components:
- `<DataTable>` — table với sort/filter/pagination
- `<SearchCommand>` — Cmd+K palette
- `<EmptyState>` — empty state với icon + CTA
- `<ErrorBoundary>` — Sentry-integrated error UI
- `<FileDropzone>` — drag-and-drop upload
- `<FormField>` — wraps Input + Label + Error
- `<ConfirmDialog>` — destructive action confirm
- `<PageHeader>` — page title + actions
- `<MetricCard>` — KPI card với delta

### Layer 3 — Features (`apps/a11y-dashboard/src/features`)

Feature-scoped components, NOT reusable:

```
features/
├── audit/
│   ├── AuditList.tsx                  # Table of audits
│   ├── AuditCard.tsx
│   ├── AuditStartForm.tsx             # New audit wizard
│   ├── AuditProgressIndicator.tsx     # Live SSE progress
│   ├── AuditScoreGauge.tsx            # Visual score 0-100
│   ├── IssueList.tsx                  # Issues table
│   ├── IssueDetailPanel.tsx           # Slide-out issue detail
│   ├── IssueFixSuggestion.tsx
│   ├── WcagBadge.tsx                  # WCAG criterion badge
│   └── SeverityBadge.tsx
├── report/
│   ├── ReportViewer.tsx               # Full report layout
│   ├── ReportPdfPreview.tsx           # Inline PDF preview
│   ├── ReportShareDialog.tsx          # Share via link
│   └── ReportExportMenu.tsx           # PDF/SARIF/CSV/MD
├── project/
│   ├── ProjectList.tsx
│   ├── ProjectCard.tsx
│   ├── ProjectSettings.tsx
│   ├── FigmaConnection.tsx            # Figma OAuth setup
│   └── IntegrationsPanel.tsx
├── team/
│   ├── MembersTable.tsx
│   ├── InviteDialog.tsx
│   ├── RoleSelector.tsx
│   └── SsoSetup.tsx
├── billing/
│   ├── PlanCard.tsx
│   ├── UsageMeter.tsx                 # Audits used / quota
│   ├── InvoiceList.tsx
│   ├── UpgradePrompt.tsx
│   └── PaymentMethodForm.tsx
└── settings/
    ├── ProfileForm.tsx
    ├── PasswordChangeForm.tsx
    ├── ApiKeyList.tsx
    ├── ApiKeyCreateDialog.tsx
    └── NotificationPreferences.tsx
```

### Layer 4 — Pages (`apps/a11y-dashboard/src/routes`)

Pages compose features:

```tsx
// src/routes/_app/audits/$id/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { auditQueryOptions } from "@/features/audit/queries";
import { AuditDetailHeader } from "@/features/audit/AuditDetailHeader";
import { AuditScoreSection } from "@/features/audit/AuditScoreSection";
import { IssueList } from "@/features/audit/IssueList";
import { ReportExportMenu } from "@/features/report/ReportExportMenu";

export const Route = createFileRoute("/_app/audits/$id/")({
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(auditQueryOptions(params.id)),
  component: AuditDetailPage,
});

function AuditDetailPage() {
  const { id } = Route.useParams();
  const { data: audit } = useSuspenseQuery(auditQueryOptions(id));

  return (
    <div className="space-y-8">
      <PageHeader title={audit.name} actions={<ReportExportMenu auditId={id} />} />
      <AuditDetailHeader audit={audit} />
      <AuditScoreSection audit={audit} />
      <IssueList auditId={id} />
    </div>
  );
}
```

---

## 5. State management strategy

### Server state (TanStack Query)

```tsx
// features/audit/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

export const auditQueryOptions = (id: string) => queryOptions({
  queryKey: ["audit", id],
  queryFn: () => api.audits.get(id),
  staleTime: 1000 * 60 * 5,                  // 5 min
  refetchOnWindowFocus: false,               // expensive query
});

export const auditListQueryOptions = (filters?: AuditFilters) => queryOptions({
  queryKey: ["audits", filters],
  queryFn: () => api.audits.list(filters),
  staleTime: 1000 * 60,
});

// Mutations
export function useStartAuditMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.audits.start,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      // Optimistically add to list
      queryClient.setQueryData(["audit", data.id], data);
    },
  });
}
```

### Client state (Zustand)

```tsx
// lib/stores/ui-store.ts
import { create } from "zustand";

interface UiStore {
  sidebarOpen: boolean;
  theme: "light" | "dark" | "system";
  toasts: Toast[];

  toggleSidebar: () => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  pushToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  sidebarOpen: true,
  theme: "system",
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setTheme: (theme) => {
    set({ theme });
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
  },
  pushToast: (toast) => set((s) => ({
    toasts: [...s.toasts, { ...toast, id: crypto.randomUUID() }]
  })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),
}));
```

### Form state (React Hook Form)

```tsx
// features/audit/AuditStartForm.tsx
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

const auditStartSchema = z.object({
  source: z.enum(["figma", "uploaded-json"]),
  figmaUrl: z.string().url().optional(),
  wcagVersion: z.enum(["2.0", "2.1", "2.2"]).default("2.2"),
  wcagLevel: z.enum(["A", "AA", "AAA"]).default("AA"),
}).refine(
  (data) => data.source !== "figma" || !!data.figmaUrl,
  { message: "Figma URL required", path: ["figmaUrl"] }
);

type AuditStartInput = z.infer<typeof auditStartSchema>;

export function AuditStartForm() {
  const form = useForm<AuditStartInput>({
    resolver: zodResolver(auditStartSchema),
    defaultValues: { source: "figma", wcagVersion: "2.2", wcagLevel: "AA" },
  });

  const startMutation = useStartAuditMutation();

  const onSubmit = (data: AuditStartInput) => {
    startMutation.mutate(data);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {/* ... */}
    </form>
  );
}
```

---

## 6. Authentication flow

### Login

```tsx
// routes/_auth/login.tsx
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

function LoginPage() {
  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    navigate({ to: "/dashboard" });
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
  };

  return (/* form */);
}
```

### Auth context

```tsx
// lib/auth-context.tsx
import { createContext, useContext, useEffect, useState } from "react";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setSession(session);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, signOut: () => supabase.auth.signOut() }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
```

### Protected route wrapper

```tsx
// routes/_app/route.tsx
import { redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    if (!context.auth.session) {
      throw redirect({
        to: "/login",
        search: { redirect: location.href },
      });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <TopBar />
        <Outlet />
      </main>
    </div>
  );
}
```

---

## 7. Real-time audit progress

### Hook to subscribe to audit stream

```tsx
// features/audit/useAuditStream.ts
import { useEffect, useState } from "react";

interface StreamState {
  status: "queued" | "running" | "completed" | "failed";
  progress: number;
  currentStep: string;
}

export function useAuditStream(auditId: string | null) {
  const [state, setState] = useState<StreamState>({
    status: "queued",
    progress: 0,
    currentStep: "",
  });

  useEffect(() => {
    if (!auditId) return;

    const eventSource = new EventSource(`/api/a11y/audit-stream?id=${auditId}`);

    eventSource.addEventListener("progress", (e) => {
      const data = JSON.parse(e.data);
      setState({ status: "running", progress: data.progress, currentStep: data.currentStep });
    });

    eventSource.addEventListener("complete", (e) => {
      setState((s) => ({ ...s, status: "completed", progress: 100 }));
      eventSource.close();
    });

    eventSource.addEventListener("error", () => {
      setState((s) => ({ ...s, status: "failed" }));
      eventSource.close();
    });

    return () => eventSource.close();
  }, [auditId]);

  return state;
}
```

### Progress UI component

```tsx
// features/audit/AuditProgressIndicator.tsx
import { motion } from "framer-motion";

export function AuditProgressIndicator({ auditId }: { auditId: string }) {
  const { status, progress, currentStep } = useAuditStream(auditId);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (status === "completed") {
      queryClient.invalidateQueries({ queryKey: ["audit", auditId] });
    }
  }, [status, auditId, queryClient]);

  return (
    <div className="space-y-4">
      <div className="h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-violet-600"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        {status === "completed" ? "Done!" : `${currentStep}...`}
      </p>
    </div>
  );
}
```

---

## 8. Performance budget (frontend)

| Metric | Target | Strategy |
|---|---|---|
| LCP (Largest Contentful Paint) | <1.8s | Image optimization, lazy load, code split |
| FID/INP (Interactivity) | <100ms | Minimize JS, defer non-critical |
| CLS (Cumulative Layout Shift) | <0.05 | Reserve space, no layout shift after load |
| TBT (Total Blocking Time) | <200ms | Web Workers cho heavy compute |
| Bundle size (gzipped) | <250KB | Tree-shaking, lazy routes |
| Time to Interactive | <2.5s | SSR + hydration optimization |

### Code splitting strategy

```tsx
// Heavy features lazy-loaded
const ReportPdfPreview = lazy(() => import("@/features/report/ReportPdfPreview"));
const IssueDetailPanel = lazy(() => import("@/features/audit/IssueDetailPanel"));

// Route-level splitting (TanStack Router does this automatically)
```

### Image optimization
- `next/image` equivalent: use `unpic-img` for non-Next setup
- Modern formats: AVIF → WebP → fallback
- Lazy load below-fold
- Blur placeholders for hero images

---

## 9. Accessibility (eat our own dog food)

The A11y dashboard itself MUST be WCAG 2.2 AA compliant. Hypocritical otherwise.

### Standards
- Use semantic HTML always (`<button>`, `<nav>`, `<main>`, `<section>`)
- ARIA roles only when semantic HTML insufficient
- All interactive elements keyboard-accessible
- Focus visible on all interactive (`outline: 2px solid var(--ring)`)
- Touch targets 44×44 minimum
- Color contrast 4.5:1 minimum body text, 3:1 large text
- Live regions for dynamic content (`aria-live="polite"`)
- Skip-to-content link
- Reduced motion respected (`prefers-reduced-motion`)
- Screen reader tested (NVDA + VoiceOver before each release)

### Tools
- `eslint-plugin-jsx-a11y` enforced in CI
- Storybook a11y addon shows violations
- Run `axe-core` in E2E tests
- Run own product on own product weekly

---

## 10. i18n strategy

- **Default:** English
- **Day-1 locales:** Vietnamese, Japanese (đã có infrastructure)
- **Year-1 locales:** Korean, Chinese Simplified
- **Library:** `@lingui/react` (better than react-i18next for bundle size)
- **Storage:** Translations in `apps/a11y-dashboard/src/locales/[locale].po`
- **Workflow:** Crowdin để community translators contribute

```tsx
import { Trans, t } from "@lingui/macro";

<Button>
  <Trans>Start audit</Trans>
</Button>

// Programmatic
const message = t`Audit completed with score ${score}/100`;
```

---

## 11. Error handling

### Layers

**Layer 1 — Global error boundary:**
```tsx
<Sentry.ErrorBoundary fallback={<ErrorFallback />}>
  <App />
</Sentry.ErrorBoundary>
```

**Layer 2 — Route error boundary:**
```tsx
export const Route = createFileRoute("/_app/audits/$id/")({
  errorComponent: AuditErrorFallback,
  // ...
});
```

**Layer 3 — Query error handling:**
```tsx
const { data, error } = useQuery({
  queryKey: ["audit", id],
  queryFn: () => api.audits.get(id),
});

if (error) {
  if (error.status === 404) return <NotFound />;
  if (error.status === 403) return <UpgradePrompt feature="Pro tier" />;
  return <GenericError error={error} />;
}
```

**Layer 4 — Mutation error toasts:**
```tsx
const mutation = useStartAuditMutation();

useEffect(() => {
  if (mutation.error) {
    pushToast({ type: "error", message: mutation.error.message });
  }
}, [mutation.error]);
```

---

## 12. Testing strategy

### Unit tests (Vitest)
- All utilities in `lib/`
- All hooks
- All Zustand stores
- Target: 80% coverage

### Component tests (Testing Library)
- All primitives in `packages/ui`
- All features (mock API)
- A11y assertions: `expect(getByRole("button", { name: "Start audit" })).toBeAccessible()`

### E2E tests (Playwright)
- Critical paths only:
  1. Sign up → first audit → view result
  2. Upgrade to Pro → checkout → confirmation
  3. Invite team member → accept invite
  4. Run audit via API key
  5. GitHub Action triggers audit on PR
- Run nightly + on every deploy to production

### Visual regression (Chromatic)
- All Storybook stories captured
- Block merge if regression > 0.1%

---

## 13. Build & deploy

### Build pipeline

```yaml
# .github/workflows/deploy-a11y.yml
name: Deploy A11y Dashboard

on:
  push:
    branches: [main]
    paths:
      - "apps/a11y-dashboard/**"
      - "packages/ui/**"
      - "packages/audit-engine/**"

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @desygn/a11y-dashboard typecheck
      - run: pnpm --filter @desygn/a11y-dashboard test
      - run: pnpm --filter @desygn/a11y-dashboard build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_A11Y_PROJECT_ID }}
          vercel-args: "--prod"
          working-directory: apps/a11y-dashboard
```

### Vercel project setup
- 1 Vercel project per app: marketing, a11y-dashboard
- Domains:
  - `a11y.desygn.ai` → a11y-dashboard
  - `desygn.ai` → marketing
- Edge functions in `api/` (shared across apps)

### Environment variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_URL=https://api.desygn.ai
VITE_STRIPE_PUBLISHABLE_KEY=
VITE_POSTHOG_KEY=
VITE_SENTRY_DSN=
```

Server-side:
```
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
REPORT_SIGNING_SECRET=
RESEND_API_KEY=
GROQ_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

---

## 14. Migration path from existing web/

Current `web/` stays untouched. New `apps/a11y-dashboard/` is independent.

**Shared code:**
- Move design tokens from `web/src/scss/_variables.scss` → `packages/ui/src/tokens/`
- Move auth logic from `web/src/auth/` → `packages/ui/src/lib/auth/`
- Move i18n from `web/src/i18n/` → `packages/ui/src/lib/i18n/`

**Don't share:**
- Routes — completely different
- Workspace store — different domain
- Plugin-specific code — keep in `plugin/`

This separation lets you ship `a11y-dashboard` independently while keeping `workspace` running.
