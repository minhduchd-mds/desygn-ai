/**
 * POST /api/github/sync-webhook
 *
 * Receives and verifies GitHub webhook events.
 * Handles: issues, pull_request, check_suite events.
 *
 * Signature verification: HMAC SHA-256 using GITHUB_WEBHOOK_SECRET env var.
 * If the secret is absent, verification is skipped with a warning (graceful degradation).
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";
import { withRateLimit } from "../lib/rate-limit";
import { getAllowedOrigin, setCorsHeaders } from "../lib/cors";

// ---------------------------------------------------------------------------
// Signature verification
// ---------------------------------------------------------------------------

/**
 * Verify the X-Hub-Signature-256 header against the raw request body.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  secret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expected = Buffer.from(`sha256=${digest}`, "utf8");
  const received = Buffer.from(signatureHeader, "utf8");
  if (expected.length !== received.length) return false;
  return timingSafeEqual(expected, received);
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

interface GitHubIssuePayload {
  action: string;
  issue: { number: number; title: string; html_url: string; state: string };
  repository: { full_name: string };
}

interface GitHubPullRequestPayload {
  action: string;
  pull_request: {
    number: number;
    title: string;
    html_url: string;
    state: string;
    merged: boolean;
  };
  repository: { full_name: string };
}

interface GitHubCheckSuitePayload {
  action: string;
  check_suite: { id: number; status: string; conclusion: string | null };
  repository: { full_name: string };
}

function handleIssuesEvent(payload: GitHubIssuePayload): void {
  const { action, issue, repository } = payload;
  if (!["opened", "closed", "reopened"].includes(action)) return;
  console.warn(
    `[webhook] issues.${action} — ${repository.full_name}#${issue.number} ` +
      `"${issue.title}" state=${issue.state} url=${issue.html_url}`
  );
}

function handlePullRequestEvent(payload: GitHubPullRequestPayload): void {
  const { action, pull_request: pr, repository } = payload;
  if (!["opened", "closed"].includes(action)) return;
  const mergeInfo = action === "closed" ? ` merged=${pr.merged}` : "";
  console.warn(
    `[webhook] pull_request.${action} — ${repository.full_name}#${pr.number} ` +
      `"${pr.title}" state=${pr.state}${mergeInfo} url=${pr.html_url}`
  );
}

function handleCheckSuiteEvent(payload: GitHubCheckSuitePayload): void {
  const { action, check_suite, repository } = payload;
  if (action !== "completed") return;
  console.warn(
    `[webhook] check_suite.completed — ${repository.full_name} ` +
      `id=${check_suite.id} status=${check_suite.status} conclusion=${check_suite.conclusion ?? "null"}`
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handler(req: VercelRequest, res: VercelResponse) {
  // --- CORS headers ---
  const origin = getAllowedOrigin(req);
  setCorsHeaders(res, origin);
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // --- Signature verification ---
  if (!secret) {
    console.warn(
      "[webhook] WARNING: GITHUB_WEBHOOK_SECRET is not set. " +
        "Signature verification is disabled. Set this env var to secure the endpoint."
    );
  } else {
    // Vercel parses the body by default; we need the raw string for HMAC
    const rawBody =
      typeof req.body === "string"
        ? req.body
        : JSON.stringify(req.body);

    const signatureHeader =
      typeof req.headers["x-hub-signature-256"] === "string"
        ? req.headers["x-hub-signature-256"]
        : Array.isArray(req.headers["x-hub-signature-256"])
          ? req.headers["x-hub-signature-256"][0]
          : undefined;

    const valid = verifyWebhookSignature(rawBody, signatureHeader, secret);
    if (!valid) {
      console.error("[webhook] Signature verification failed.");
      return res.status(401).json({ error: "Invalid webhook signature" });
    }
  }

  // --- Event routing ---
  const eventType =
    typeof req.headers["x-github-event"] === "string"
      ? req.headers["x-github-event"]
      : Array.isArray(req.headers["x-github-event"])
        ? req.headers["x-github-event"][0]
        : "unknown";

  const payload = req.body as Record<string, unknown>;

  try {
    switch (eventType) {
      case "issues":
        handleIssuesEvent(payload as unknown as GitHubIssuePayload);
        break;
      case "pull_request":
        handlePullRequestEvent(payload as unknown as GitHubPullRequestPayload);
        break;
      case "check_suite":
        handleCheckSuiteEvent(payload as unknown as GitHubCheckSuitePayload);
        break;
      case "ping":
        console.warn("[webhook] ping received — webhook configured successfully");
        break;
      default:
        console.warn(`[webhook] unhandled event type: ${eventType}`);
    }
  } catch (err) {
    // Log but do not surface internal errors to GitHub
    console.error("[webhook] Error processing event:", err);
  }

  return res.status(200).json({ received: true });
}

// Wrap with rate limit: 50 req / 60 s (GitHub delivers at most a few per second)
export default withRateLimit(handler, "github-sync-webhook", 50);
