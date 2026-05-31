/**
 * Inngest client — memoized singleton for the Desygn A11y app.
 *
 * Returns `null` when either INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY is
 * missing so that route handlers can degrade gracefully in local / preview
 * environments (mirrors the pattern in `api/lib/rate-limit.ts` and
 * `api/lib/supabase-admin.ts`).
 *
 * The serve handler in `api/inngest/[..route].ts` (created elsewhere) will
 * skip registering functions when `getInngest()` returns null.
 */

import { EventSchemas, Inngest } from "inngest";
import type { AuditStartEvent } from "./events.js";

export const INNGEST_APP_ID = "desygn-a11y";

type DesygnEvents = {
  "audit/start": { data: AuditStartEvent["data"] };
};

const schemas = new EventSchemas().fromRecord<DesygnEvents>();

export type DesygnInngest = Inngest<{
  id: typeof INNGEST_APP_ID;
  schemas: typeof schemas;
}>;

/**
 * A module-level client used only to *declare* function definitions
 * (`createFunction`). It is never used to send events — sending requires
 * `getInngest()`, which returns null when env keys are missing.
 *
 * Defining functions does not require an event/signing key; Inngest signs
 * outbound traffic at serve-time. This split lets the runner be statically
 * importable while preserving the env-guarded send path.
 */
export const inngest: DesygnInngest = new Inngest({
  id: INNGEST_APP_ID,
  schemas,
});

let memoized: DesygnInngest | null = null;

/**
 * Build (or return the memoized) Inngest client for sending events.
 *
 * Returns null when env vars are not configured — callers MUST handle
 * this case (treat as "background queue not configured").
 */
export function getInngest(): DesygnInngest | null {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;
  if (!eventKey || !signingKey) return null;

  if (!memoized) {
    memoized = new Inngest({
      id: INNGEST_APP_ID,
      schemas,
      eventKey,
      signingKey,
    });
  }
  return memoized;
}

/** Test-only: reset the memoized client (used by unit tests). */
export function __resetInngestForTests(): void {
  memoized = null;
}
