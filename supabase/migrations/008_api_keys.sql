-- 008_api_keys.sql
-- Personal + team API keys for programmatic access (Pro+ tier).
--
-- Source: docs/architecture-v6/03-backend-architecture.md Section 3
-- Keys are SHA-256 hashed before storage; only the prefix (sk_live_xxxx)
-- is displayed in UI for identification.

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade,
  team_id      uuid references public.teams(id) on delete cascade,
  name         text not null,
  key_hash     text unique not null,                  -- SHA-256 of key
  key_prefix   text not null,                         -- First 8 chars for display (dak_live_abc...)
  scopes       text[] not null default '{audit:read,audit:write}',
  last_used_at timestamptz,
  expires_at   timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz default now()
);

create index if not exists idx_api_keys_hash on api_keys(key_hash) where revoked_at is null;
create index if not exists idx_api_keys_user on api_keys(user_id);
create index if not exists idx_api_keys_team on api_keys(team_id);

alter table api_keys enable row level security;

create policy "Users manage own keys"
  on api_keys for all using (user_id = auth.uid());

create policy "Team admins manage team keys"
  on api_keys for all using (
    team_id in (
      select team_id from team_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );
