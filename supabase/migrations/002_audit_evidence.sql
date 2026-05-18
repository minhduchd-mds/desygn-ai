-- 002_audit_evidence.sql
-- Adds audit run tracking, checklist results, evidence artifacts,
-- GitHub issue/PR linking, and agent execution logging.

-- Design context versions (extends existing project_versions with source tracking)
create table if not exists public.design_context_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  source text not null check (source in ('figma-plugin', 'figma-link', 'screenshot', 'web-url', 'manual-spec')),
  source_ref text,
  version_number integer not null,
  context_json jsonb not null,
  checksum text,
  created_at timestamptz default now()
);

-- Audit runs
create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  design_context_version_id uuid references public.design_context_versions(id),
  source text not null,
  overall_score integer check (overall_score >= 0 and overall_score <= 100),
  status text not null default 'running' check (status in ('running', 'completed', 'failed', 'cancelled')),
  created_at timestamptz default now()
);

-- Checklist results (per criterion per audit run)
create table if not exists public.checklist_results (
  id uuid primary key default gen_random_uuid(),
  audit_run_id uuid references public.audit_runs(id) on delete cascade not null,
  check_id text not null,
  status text not null check (status in ('pass', 'fail', 'warn', 'skip', 'error')),
  score numeric not null check (score >= 0 and score <= 1),
  severity text check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  confidence numeric check (confidence >= 0 and confidence <= 1),
  reason text,
  fix_suggestion jsonb,
  created_at timestamptz default now()
);

-- Evidence artifacts (screenshots, node refs, observed/expected)
create table if not exists public.evidence_artifacts (
  id uuid primary key default gen_random_uuid(),
  checklist_result_id uuid references public.checklist_results(id) on delete cascade not null,
  source text not null check (source in ('figma-node', 'playwright-screenshot', 'manual', 'ai-vision')),
  node_id text,
  selector text,
  screenshot_url text,
  bounding_box jsonb,
  observed text not null,
  expected text not null,
  created_at timestamptz default now()
);

-- GitHub issues linked to checklist results
create table if not exists public.github_issues (
  id uuid primary key default gen_random_uuid(),
  checklist_result_id uuid references public.checklist_results(id) on delete cascade not null,
  repo text not null,
  issue_number integer,
  issue_url text,
  status text not null default 'created' check (status in ('created', 'open', 'assigned', 'in-progress', 'closed')),
  created_at timestamptz default now()
);

-- GitHub PRs linked to issues
create table if not exists public.github_pull_requests (
  id uuid primary key default gen_random_uuid(),
  github_issue_id uuid references public.github_issues(id) on delete cascade not null,
  repo text not null,
  pr_number integer,
  pr_url text,
  status text check (status in ('draft', 'open', 'merged', 'closed')),
  ci_status text check (ci_status in ('pending', 'success', 'failure')),
  created_at timestamptz default now()
);

-- Agent execution log
create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  provider text not null,
  agent_type text not null,
  input_json jsonb,
  output_json jsonb,
  status text not null check (status in ('running', 'completed', 'failed', 'cancelled')),
  cost_usd numeric,
  latency_ms integer,
  created_at timestamptz default now()
);

-- RLS policies (all tables use project ownership through joins)
alter table public.design_context_versions enable row level security;
alter table public.audit_runs enable row level security;
alter table public.checklist_results enable row level security;
alter table public.evidence_artifacts enable row level security;
alter table public.github_issues enable row level security;
alter table public.github_pull_requests enable row level security;
alter table public.agent_runs enable row level security;

-- RLS: users see own project data
create policy "users see own design_context_versions" on public.design_context_versions for all
  using (project_id in (select id from public.projects where user_id = auth.uid()));

create policy "users see own audit_runs" on public.audit_runs for all
  using (project_id in (select id from public.projects where user_id = auth.uid()));

create policy "users see own checklist_results" on public.checklist_results for all
  using (audit_run_id in (
    select ar.id from public.audit_runs ar
    join public.projects p on ar.project_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "users see own evidence_artifacts" on public.evidence_artifacts for all
  using (checklist_result_id in (
    select cr.id from public.checklist_results cr
    join public.audit_runs ar on cr.audit_run_id = ar.id
    join public.projects p on ar.project_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "users see own github_issues" on public.github_issues for all
  using (checklist_result_id in (
    select cr.id from public.checklist_results cr
    join public.audit_runs ar on cr.audit_run_id = ar.id
    join public.projects p on ar.project_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "users see own github_pull_requests" on public.github_pull_requests for all
  using (github_issue_id in (
    select gi.id from public.github_issues gi
    join public.checklist_results cr on gi.checklist_result_id = cr.id
    join public.audit_runs ar on cr.audit_run_id = ar.id
    join public.projects p on ar.project_id = p.id
    where p.user_id = auth.uid()
  ));

create policy "users see own agent_runs" on public.agent_runs for all
  using (project_id in (select id from public.projects where user_id = auth.uid()));

-- Indexes for common queries
create index idx_design_context_versions_project on public.design_context_versions(project_id, created_at desc);
create index idx_audit_runs_project on public.audit_runs(project_id, created_at desc);
create index idx_checklist_results_audit on public.checklist_results(audit_run_id);
create index idx_evidence_artifacts_result on public.evidence_artifacts(checklist_result_id);
create index idx_github_issues_result on public.github_issues(checklist_result_id);
create index idx_agent_runs_project on public.agent_runs(project_id, created_at desc);
