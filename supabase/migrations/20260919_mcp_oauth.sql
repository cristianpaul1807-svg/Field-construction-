-- MCP OAuth 2.1 Authorization Code + PKCE storage.
-- Tokens and codes are stored only as hashes; service-role backend access is required.
create table if not exists public.mcp_oauth_clients (
  client_id text primary key,
  client_name text not null,
  redirect_uris text[] not null,
  token_endpoint_auth_method text not null default 'none',
  created_at timestamptz not null default now()
);
create table if not exists public.mcp_oauth_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  redirect_uri text not null,
  resource text not null,
  code_challenge text not null,
  scope text not null,
  connection_id uuid not null references public.mcp_connections(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create table if not exists public.mcp_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.mcp_connections(id) on delete cascade,
  client_id text not null references public.mcp_oauth_clients(client_id) on delete cascade,
  access_token_hash text not null unique,
  refresh_token_hash text not null unique,
  scope text not null,
  resource text not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists mcp_oauth_tokens_access_idx on public.mcp_oauth_tokens(access_token_hash) where revoked_at is null;
create index if not exists mcp_oauth_tokens_refresh_idx on public.mcp_oauth_tokens(refresh_token_hash) where revoked_at is null;
alter table public.mcp_oauth_clients enable row level security;
alter table public.mcp_oauth_codes enable row level security;
alter table public.mcp_oauth_tokens enable row level security;
