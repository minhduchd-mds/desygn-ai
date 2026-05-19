-- 003_user_profiles_rbac.sql
-- User profiles and role-based access control.
-- Maps to shared/permissions/ TypeScript module (22 scopes, 9 roles).

-- ═══════════════════════════════════════════════════════════════════════════════
-- User profiles (extends auth.users with app-specific fields)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  avatar_url text,
  global_role text not null default 'member'
    check (global_role in ('owner', 'admin', 'member', 'viewer', 'guest')),
  onboarded_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════════
-- Project members (project-level roles)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'viewer'
    check (role in ('project:owner', 'project:editor', 'project:reviewer', 'project:viewer')),
  invited_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (project_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- API keys (for CI/CD integrations and webhook auth)
-- ═══════════════════════════════════════════════════════════════════════════════

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  key_hash text not null,
  prefix text not null,
  scopes text[] not null default '{}',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS policies
-- ═══════════════════════════════════════════════════════════════════════════════

alter table public.user_profiles enable row level security;
alter table public.project_members enable row level security;
alter table public.api_keys enable row level security;

-- Users can read any profile (for display names / avatars)
create policy "anyone can read profiles" on public.user_profiles
  for select using (true);

-- Users can update only their own profile
create policy "users update own profile" on public.user_profiles
  for update using (auth.uid() = id);

-- Project members: users see memberships for their own projects
create policy "users see own project members" on public.project_members
  for select using (
    user_id = auth.uid()
    or project_id in (select id from public.projects where user_id = auth.uid())
  );

-- Project owners can manage members
create policy "project owners manage members" on public.project_members
  for all using (
    project_id in (select id from public.projects where user_id = auth.uid())
  );

-- API keys: users manage only their own
create policy "users manage own api_keys" on public.api_keys
  for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- Update the projects RLS to support project_members access
-- ═══════════════════════════════════════════════════════════════════════════════

-- Members can read projects they belong to
create policy "members read shared projects" on public.projects
  for select using (
    id in (select project_id from public.project_members where user_id = auth.uid())
  );

-- ═══════════════════════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════════════════════

create index idx_project_members_user on public.project_members(user_id);
create index idx_project_members_project on public.project_members(project_id);
create index idx_api_keys_user on public.api_keys(user_id);
create index idx_api_keys_prefix on public.api_keys(prefix);
