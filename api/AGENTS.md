# API Agent Guide

## Scope
Server-side trust boundary for authentication, quotas, persistence, external AI/provider calls and privileged integrations.

## Rules
- Validate request method, auth, authorization and payload schema before side effects.
- Keep service-role/provider secrets server-only; never echo them in responses or logs.
- Treat URLs, remote content, user prompts, files and provider output as untrusted.
- Apply rate/quota limits and explicit timeouts to expensive/provider-backed operations.
- Prevent cross-tenant data access with server-side ownership checks; do not rely only on client filtering.
- Normalize provider responses into shared domain contracts and validate with Zod.
- Add idempotency for retryable write/webhook paths.
- Do not place customer/private/proprietary material in fixtures or prompts; use synthetic examples.
- Prefer reusable package logic over duplicating audit/report rules inside endpoints.

## Verification
Add tests for auth failure, invalid payload, missing env/degraded mode, authorization scope, provider failure/timeout and successful response contracts.
