-- 007_audit_queue.sql
-- Async audit job queue (backup to Inngest for at-least-once delivery).
--
-- Source: docs/architecture-v6/03-backend-architecture.md Section 3
-- Inngest is the primary executor; this table provides a DB-side fallback
-- record for retries, monitoring, and idempotency.

create table if not exists public.audit_queue (
  id            uuid primary key default gen_random_uuid(),
  audit_run_id  uuid references public.audit_runs(id) on delete cascade not null,
  user_id       uuid references auth.users(id) not null,
  priority      int not null default 5 check (priority between 0 and 10),
  status        text not null default 'pending'
                check (status in ('pending', 'processing', 'completed', 'failed', 'retrying')),
  attempts      int not null default 0,
  max_attempts  int not null default 3,
  payload       jsonb not null,
  error         text,
  scheduled_for timestamptz default now(),
  started_at    timestamptz,
  completed_at  timestamptz,
  created_at    timestamptz default now()
);

create index if not exists idx_queue_pending on audit_queue(status, scheduled_for)
  where status in ('pending', 'retrying');
create index if not exists idx_queue_user on audit_queue(user_id, created_at desc);

alter table audit_queue enable row level security;

create policy "Users see own queue items"
  on audit_queue for select using (user_id = auth.uid());
