/**
 * router — code-based TanStack Router setup (no file-based codegen).
 *
 * Tree:
 *   __root__
 *     /            -> redirect to /dashboard (authed) or /login
 *     /login       -> <Login>  (standalone, owns its <main>)
 *     /signup      -> <Signup> (standalone, owns its <main>)
 *     [id:shell]   -> <AppShell> (pathless layout route, owns the <main>)
 *       /dashboard -> <Dashboard>
 *       /audits    -> <Audits>
 *       /settings  -> <Settings>
 *
 * Auth guarding runs in `beforeLoad` and reads the auth snapshot injected via
 * the router context (RouterProvider `context={{ auth }}`). Guards only fire
 * once the initial session check has resolved (loading === false) so we never
 * bounce an authenticated user to /login on a cold load.
 *
 * Degrade-without-backend: when Supabase is NOT configured the protected
 * routes render anyway (dev mode); only when it IS configured do we redirect
 * unauthenticated users to /login.
 */

import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  redirect,
} from "@tanstack/react-router";
import { Spinner } from "@desygn/ui";
import type { AuthState } from "./auth/AuthContext.js";
import { isSupabaseConfigured } from "./lib/supabase.js";
import { useTranslation } from "./i18n/index.js";
import { AppShell } from "./components/AppShell.js";
import { LanguageToggle } from "./components/LanguageToggle.js";
import { Dashboard } from "./routes/Dashboard.js";
import { Audits } from "./routes/Audits.js";
import { Settings } from "./routes/Settings.js";
import { Login } from "./routes/Login.js";
import { Signup } from "./routes/Signup.js";
import { VerifyPage } from "./routes/Verify.js";

/**
 * IndexPending — shown at `/` only while a CONFIGURED backend resolves the
 * initial session (a brief window before the redirect fires). Kept fully
 * structural (one <main>, one <h1>, enabled buttons via the toggle) so the
 * route never violates the a11y/e2e contract even if it lingers.
 */
function IndexPending() {
  const { t } = useTranslation();
  return (
    <main style={{ display: "grid", placeItems: "center", minHeight: "100vh", gap: "var(--space-4)" }}>
      <h1 style={{ margin: 0 }}>{t("shell.brand")}</h1>
      <Spinner />
      <LanguageToggle />
    </main>
  );
}

/** Context shape available to every route's beforeLoad/loader. */
export interface RouterContext {
  auth: AuthState;
}

const rootRoute = createRootRouteWithContext<RouterContext>()();

/** `/` — send users to the right place once auth has resolved. */
const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  beforeLoad: ({ context }) => {
    // No backend: the destination is known immediately — don't wait on the
    // (already-resolved) loading flag, just send users to /login so `/` never
    // lingers blank in degraded mode.
    if (!isSupabaseConfigured()) {
      throw redirect({ to: "/login" });
    }
    // Backend configured: wait for the initial session check before deciding.
    if (context.auth.loading) return;
    if (context.auth.session) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/login" });
  },
  component: IndexPending,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: Login,
});

const signupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/signup",
  component: Signup,
});

/**
 * `/verify` — PUBLIC PDF verification page. Sibling of /login + /signup
 * (NOT under the AppShell): no auth guard, no app chrome, owns its own
 * <main>. Lets external auditors validate a signed report without an
 * account.
 */
const verifyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/verify",
  component: VerifyPage,
});

/**
 * Pathless layout route that renders the authenticated shell. Children mount
 * inside <AppShell>'s <Outlet />. The guard protects all of them at once.
 */
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "shell",
  beforeLoad: ({ context }) => {
    // No backend -> allow through (dev / degrade).
    if (!isSupabaseConfigured()) return;
    // Backend configured: wait for resolution, then require a session.
    if (context.auth.loading) return;
    if (!context.auth.session) {
      throw redirect({ to: "/login" });
    }
  },
  component: AppShell,
});

const dashboardRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/dashboard",
  component: Dashboard,
});

const auditsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/audits",
  component: Audits,
});

const settingsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/settings",
  component: Settings,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  loginRoute,
  signupRoute,
  verifyRoute,
  shellRoute.addChildren([dashboardRoute, auditsRoute, settingsRoute]),
]);

export const router = createRouter({
  routeTree,
  // Real auth is injected per-render via RouterProvider's `context` prop;
  // this placeholder satisfies the type and the very first synchronous read.
  context: {
    auth: {
      session: null,
      user: null,
      loading: true,
      signOut: async () => {},
    },
  },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
