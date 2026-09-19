-- Allow the principal business owner to use the same read-only MCP OAuth flow.
-- This is additive: worker and subcontractor connections remain unchanged.
alter table public.mcp_connections
  add column if not exists owner_auth_user_id uuid references auth.users(id) on delete cascade;

alter table public.mcp_audit_log
  add column if not exists owner_auth_user_id uuid references auth.users(id) on delete set null;

create index if not exists mcp_connections_owner_auth_idx
  on public.mcp_connections(owner_auth_user_id)
  where owner_auth_user_id is not null;

create index if not exists mcp_audit_log_owner_auth_idx
  on public.mcp_audit_log(owner_auth_user_id)
  where owner_auth_user_id is not null;

alter table public.mcp_connections
  drop constraint if exists mcp_connections_one_identity_check;

alter table public.mcp_connections
  add constraint mcp_connections_one_identity_check
  check (
    ((employee_id is not null)::int + (subcontractor_id is not null)::int + (owner_auth_user_id is not null)::int) = 1
  );
