-- Unified role assignment for field employees and subcontractors.
-- employees.role / subcontractors.trade remain descriptive job information;
-- role_id is the sole source of application and MCP permissions.
alter table public.roles drop constraint if exists roles_name_check;
alter table public.roles add constraint roles_name_check check (name = any (array['admin','oficina','tecnico','trabajador_de_campo','subcontratista','jefe_de_obra','contabilidad']));

alter table public.employees
  add column if not exists role_id uuid references public.roles(id) on delete set null,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text;

alter table public.subcontractors
  add column if not exists role_id uuid references public.roles(id) on delete set null,
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null,
  add column if not exists email text;

create index if not exists employees_role_idx on public.employees(business_id, role_id);
create index if not exists subcontractors_role_idx on public.subcontractors(business_id, role_id);
create unique index if not exists employees_auth_user_idx on public.employees(auth_user_id) where auth_user_id is not null;
create unique index if not exists subcontractors_auth_user_idx on public.subcontractors(auth_user_id) where auth_user_id is not null;

do $$
declare b record;
begin
  for b in select id from public.businesses loop
    insert into public.roles (business_id, name, permissions)
      select b.id, v.name, v.permissions
      from (values
        ('trabajador_de_campo','["campo"]'::jsonb),
        ('subcontratista','["campo"]'::jsonb),
        ('jefe_de_obra','["campo"]'::jsonb),
        ('oficina','["campo","clientes"]'::jsonb),
        ('contabilidad','["dinero","clientes"]'::jsonb)
      ) v(name, permissions)
      where not exists (select 1 from public.roles r where r.business_id = b.id and r.name = v.name);
  end loop;
end $$;
