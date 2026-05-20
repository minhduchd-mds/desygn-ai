# Supabase migrations

Numbered SQL migrations applied in order with `supabase db push` once the
project has been linked via `supabase link --project-ref <ref>`.

| # | File | Purpose | Status |
|---|---|---|---|
| 001 | `001_project_versions.sql` | (existing) Project versions table | Applied |
| 002 | `002_audit_evidence.sql` | (existing) Audit runs + evidence artifacts | Applied |
| 003 | `003_user_profiles_rbac.sql` | (existing) User profiles + RBAC roles | Applied |
| 004 | `004_agent_runs.sql` | (existing) Agent fleet run history | Applied |
| **005** | `005_billing_subscriptions.sql` | Stripe subscriptions, teams, team_members, usage_events | **Pending owner** |
| **006** | `006_a11y_audit_extensions.sql` | A11y-specific audit columns, rule registry, issues, trends MV | **Pending owner** |
| **007** | `007_audit_queue.sql` | Async audit job queue (Inngest backup) | **Pending owner** |
| **008** | `008_api_keys.sql` | Personal + team API keys | **Pending owner** |

> Migrations 005-008 added in Week 0 scaffolding for Desygn A11y Move 1.
> See `docs/architecture-v6/03-backend-architecture.md` Section 3.

## Apply migrations

```bash
# Initial setup (one-time)
npx supabase login
npx supabase link --project-ref <your-project-ref>

# Apply (staging first)
npx supabase db push

# Verify
npx supabase db diff
```

## Migration order dependencies

- **005** must run before **006** (audit_issues + team_rule_overrides reference teams)
- **006** must run before **007** (audit_queue references audit_runs, which 006 extends)
- **008** can run independently after **005** (api_keys references teams)
