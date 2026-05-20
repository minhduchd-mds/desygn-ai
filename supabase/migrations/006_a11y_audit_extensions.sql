-- 006_a11y_audit_extensions.sql
-- Extends existing audit_runs (002) with A11y-specific columns,
-- adds rule registry, team overrides, and trend materialized view.
--
-- Source: docs/architecture-v6/03-backend-architecture.md Section 3
-- Depends on: 002_audit_evidence.sql (audit_runs table)

-- ─── Extend audit_runs ─────────────────────────────────────────
alter table public.audit_runs
  add column if not exists wcag_version    text default '2.2' check (wcag_version in ('2.0', '2.1', '2.2', '3.0')),
  add column if not exists wcag_level      text default 'AA' check (wcag_level in ('A', 'AA', 'AAA')),
  add column if not exists figma_file_key  text,
  add column if not exists figma_node_id   text,
  add column if not exists frame_count     int,
  add column if not exists node_count      int,
  add column if not exists audit_duration_ms int,
  add column if not exists report_signature text,
  add column if not exists pdf_url         text,
  add column if not exists sarif_url       text,
  add column if not exists input_checksum  text;

create index if not exists idx_audit_runs_user_time on audit_runs(project_id, created_at desc);
create index if not exists idx_audit_runs_figma on audit_runs(figma_file_key);
create index if not exists idx_audit_runs_checksum on audit_runs(input_checksum);

-- ─── A11y rule registry ────────────────────────────────────────
create table if not exists public.a11y_rules (
  id             text primary key,
  wcag_criterion text not null,
  wcag_level     text not null check (wcag_level in ('A', 'AA', 'AAA')),
  category       text not null check (category in ('contrast', 'touch-target', 'aria', 'keyboard', 'heading', 'motion', 'semantic')),
  severity       text not null default 'medium' check (severity in ('critical', 'serious', 'moderate', 'minor')),
  enabled        boolean default true,
  configuration  jsonb default '{}'::jsonb,
  description    text not null,
  created_at     timestamptz default now()
);

-- Seed default rules from packages/audit-engine
insert into public.a11y_rules (id, wcag_criterion, wcag_level, category, severity, description) values
  ('contrast.text',           '1.4.3', 'AA', 'contrast',     'serious',  'Text must have sufficient contrast against background.'),
  ('touch-target.size',       '2.5.8', 'AA', 'touch-target', 'moderate', 'Interactive elements must meet minimum touch target size.'),
  ('aria.accessible-name',    '4.1.2', 'A',  'aria',         'critical', 'Interactive elements must expose name, role, and value to AT.'),
  ('keyboard.focus-indicator','2.4.7', 'AA', 'keyboard',     'moderate', 'Interactive elements must have visible focus indicators.'),
  ('heading.hierarchy',       '1.3.1', 'A',  'heading',      'moderate', 'Heading levels must form a logical hierarchy.'),
  ('motion.reduced-motion',   '2.3.3', 'AAA','motion',       'moderate', 'Motion must respect prefers-reduced-motion.'),
  ('semantic.structure',      '1.3.1', 'A',  'semantic',     'serious',  'Interactive elements should use semantic node types.')
on conflict (id) do nothing;

-- ─── Team rule overrides ───────────────────────────────────────
create table if not exists public.team_rule_overrides (
  team_id       uuid references public.teams(id) on delete cascade not null,
  rule_id       text references public.a11y_rules(id) on delete cascade not null,
  enabled       boolean,
  configuration jsonb,
  primary key (team_id, rule_id)
);

-- ─── Audit issues ──────────────────────────────────────────────
create table if not exists public.audit_issues (
  id                uuid primary key default gen_random_uuid(),
  audit_run_id      uuid references public.audit_runs(id) on delete cascade not null,
  rule_id           text references public.a11y_rules(id) not null,
  severity          text not null check (severity in ('critical', 'serious', 'moderate', 'minor')),
  node_id           text not null,
  node_name         text,
  node_type         text,
  page_name         text,
  message           text not null,
  expected          text,
  observed          text,
  fix_suggestion    jsonb,
  wcag_criterion    text,
  status            text not null default 'open' check (status in ('open', 'fixed', 'wont-fix', 'false-positive')),
  fixed_in_audit_id uuid references audit_runs(id),
  created_at        timestamptz default now()
);

create index if not exists idx_audit_issues_run on audit_issues(audit_run_id);
create index if not exists idx_audit_issues_rule on audit_issues(rule_id);
create index if not exists idx_audit_issues_severity on audit_issues(severity);
create index if not exists idx_audit_issues_status on audit_issues(status);

-- ─── Trends materialized view ──────────────────────────────────
create materialized view if not exists a11y_trends as
select
  ar.project_id,
  date_trunc('day', ar.created_at)::date as audit_date,
  count(*) as audit_count,
  avg(ar.overall_score) as avg_score,
  sum(case when ai.severity = 'critical' then 1 else 0 end) as critical_count,
  sum(case when ai.severity = 'serious' then 1 else 0 end) as serious_count
from audit_runs ar
left join audit_issues ai on ai.audit_run_id = ar.id
where ar.status = 'completed'
group by ar.project_id, date_trunc('day', ar.created_at)::date;

create unique index if not exists idx_a11y_trends on a11y_trends(project_id, audit_date);

-- ─── RLS on new tables ─────────────────────────────────────────
alter table audit_issues enable row level security;
alter table a11y_rules   enable row level security;
alter table team_rule_overrides enable row level security;

create policy "Audit issues follow audit_runs visibility"
  on audit_issues for select using (
    audit_run_id in (
      select id from audit_runs
      where project_id in (select id from public.project_versions where owner_id = auth.uid())
    )
  );

create policy "Anyone can read enabled rules"
  on a11y_rules for select using (enabled = true);

create policy "Team admins manage team rule overrides"
  on team_rule_overrides for all using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
