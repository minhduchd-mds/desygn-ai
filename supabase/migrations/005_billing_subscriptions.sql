-- 005_billing_subscriptions.sql
-- Stripe subscription state + team mgmt + usage tracking
--
-- Source: docs/architecture-v6/03-backend-architecture.md Section 3
-- Apply with: supabase db push (when SUPABASE_DB_PASSWORD set)

-- ─── Subscriptions ─────────────────────────────────────────────
create table if not exists public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid references auth.users(id) on delete cascade not null,
  team_id                uuid references public.teams(id) on delete cascade,
  stripe_customer_id     text unique not null,
  stripe_subscription_id text unique not null,
  tier                   text not null check (tier in ('free', 'pro', 'team', 'enterprise')),
  status                 text not null check (status in ('active', 'past_due', 'canceled', 'trialing', 'incomplete')),
  current_period_start   timestamptz not null,
  current_period_end     timestamptz not null,
  cancel_at_period_end   boolean default false,
  metadata               jsonb default '{}'::jsonb,
  created_at             timestamptz default now(),
  updated_at             timestamptz default now()
);

create index if not exists idx_subscriptions_user on subscriptions(user_id);
create index if not exists idx_subscriptions_team on subscriptions(team_id);
create index if not exists idx_subscriptions_stripe on subscriptions(stripe_subscription_id);

-- ─── Teams ─────────────────────────────────────────────────────
create table if not exists public.teams (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text unique not null,
  owner_id          uuid references auth.users(id) on delete restrict not null,
  seat_count        int not null default 5,
  custom_branding   jsonb,
  custom_wcag_rules jsonb,
  sso_enabled       boolean default false,
  sso_config        jsonb,
  data_residency    text default 'us' check (data_residency in ('us', 'eu', 'apac')),
  created_at        timestamptz default now()
);

create index if not exists idx_teams_owner on teams(owner_id);
create index if not exists idx_teams_slug on teams(slug);

-- ─── Team members ──────────────────────────────────────────────
create table if not exists public.team_members (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid references public.teams(id) on delete cascade not null,
  user_id    uuid references auth.users(id) on delete cascade not null,
  role       text not null check (role in ('owner', 'admin', 'editor', 'viewer')),
  invited_by uuid references auth.users(id),
  invited_at timestamptz default now(),
  joined_at  timestamptz,
  unique (team_id, user_id)
);

create index if not exists idx_team_members_team on team_members(team_id);
create index if not exists idx_team_members_user on team_members(user_id);

-- ─── Usage events ──────────────────────────────────────────────
create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  team_id    uuid references public.teams(id) on delete cascade,
  event_type text not null,    -- 'audit', 'pdf_export', 'api_call'
  quantity   int not null default 1,
  metadata   jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_usage_events_user_time on usage_events(user_id, created_at desc);
create index if not exists idx_usage_events_team_time on usage_events(team_id, created_at desc);
create index if not exists idx_usage_events_type_time on usage_events(event_type, created_at desc);

-- ─── RLS ───────────────────────────────────────────────────────
alter table subscriptions enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table usage_events enable row level security;

create policy "Users see own subscriptions"
  on subscriptions for select using (user_id = auth.uid());

create policy "Team members see team subscription"
  on subscriptions for select using (
    team_id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Team members see team"
  on teams for select using (
    id in (select team_id from team_members where user_id = auth.uid())
  );

create policy "Team admins manage members"
  on team_members for all using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Users see own usage"
  on usage_events for select using (user_id = auth.uid());
