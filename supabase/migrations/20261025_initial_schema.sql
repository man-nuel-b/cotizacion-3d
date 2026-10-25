-- bat-kubiqueitor / cotizacion-3d
-- Supabase PostgreSQL foundation schema

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  rut text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'seller' check (role in ('owner','admin','seller','viewer')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  company text,
  rut text,
  phone text,
  email text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  name text not null default 'Proyecto modular',
  status text not null default 'draft' check (status in ('draft','quoted','approved','cancelled','archived')),
  container_type text,
  solution_type text,
  project_state jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_organization_idx on public.projects(organization_id);
create index if not exists projects_customer_idx on public.projects(customer_id);
create index if not exists projects_state_gin_idx on public.projects using gin(project_state);

create table if not exists public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_type text not null,
  item_key text,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'un',
  face text,
  position jsonb,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_items_project_idx on public.project_items(project_id);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  name text not null,
  website text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  sku text,
  name text not null,
  category text,
  unit text not null default 'un',
  specification jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sku)
);

create index if not exists materials_name_idx on public.materials(name);

create table if not exists public.supplier_prices (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  supplier_sku text,
  product_url text,
  price_clp numeric(14,2) not null check (price_clp >= 0),
  currency text not null default 'CLP',
  stock_status text,
  captured_at timestamptz not null default now(),
  is_manual boolean not null default false,
  source text,
  unique (material_id, supplier_id, captured_at)
);

create index if not exists supplier_prices_material_idx on public.supplier_prices(material_id, captured_at desc);

create table if not exists public.apu_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  apu_code text not null,
  apu_name text not null,
  resource_type text not null check (resource_type in ('material','labor','equipment','subcontract','other')),
  material_id uuid references public.materials(id) on delete set null,
  description text not null,
  unit text not null,
  quantity numeric(14,4) not null default 1,
  unit_cost_clp numeric(14,2),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists apu_resources_code_idx on public.apu_resources(organization_id, apu_code);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  quote_number text not null,
  status text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  subtotal_clp numeric(14,2) not null default 0,
  margin_clp numeric(14,2) not null default 0,
  transport_clp numeric(14,2) not null default 0,
  tax_clp numeric(14,2) not null default 0,
  total_clp numeric(14,2) not null default 0,
  valid_until date,
  snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number)
);

create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  item_type text not null,
  description text not null,
  quantity numeric(14,3) not null default 1,
  unit text not null default 'un',
  unit_price_clp numeric(14,2) not null default 0,
  total_clp numeric(14,2) generated always as (quantity * unit_price_clp) stored,
  source_ref jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  price_clp numeric(14,2) not null,
  source text,
  captured_at timestamptz not null default now()
);

create index if not exists price_history_lookup_idx on public.price_history(material_id, captured_at desc);

create table if not exists public.audit_log (
  id bigint generated by default as identity primary key,
  organization_id uuid references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.user_in_org(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.user_is_org_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.role in ('owner','admin')
  );
$$;

create trigger organizations_set_updated_at before update on public.organizations for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger customers_set_updated_at before update on public.customers for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger project_items_set_updated_at before update on public.project_items for each row execute function public.set_updated_at();
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
create trigger materials_set_updated_at before update on public.materials for each row execute function public.set_updated_at();
create trigger apu_resources_set_updated_at before update on public.apu_resources for each row execute function public.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.organization_members enable row level security;
alter table public.customers enable row level security;
alter table public.projects enable row level security;
alter table public.project_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.materials enable row level security;
alter table public.supplier_prices enable row level security;
alter table public.apu_resources enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.price_history enable row level security;
alter table public.audit_log enable row level security;

create policy "profiles own row" on public.profiles
for all using (id = auth.uid()) with check (id = auth.uid());

create policy "members view own memberships" on public.organization_members
for select using (user_id = auth.uid() or public.user_is_org_admin(organization_id));

create policy "admins manage memberships" on public.organization_members
for all using (public.user_is_org_admin(organization_id)) with check (public.user_is_org_admin(organization_id));

create policy "members view organizations" on public.organizations
for select using (public.user_in_org(id));

create policy "admins update organizations" on public.organizations
for update using (public.user_is_org_admin(id)) with check (public.user_is_org_admin(id));

create policy "members access customers" on public.customers
for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));

create policy "members access projects" on public.projects
for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));

create policy "members access project items" on public.project_items
for all using (
  exists (select 1 from public.projects p where p.id = project_id and public.user_in_org(p.organization_id))
) with check (
  exists (select 1 from public.projects p where p.id = project_id and public.user_in_org(p.organization_id))
);

create policy "members access suppliers" on public.suppliers
for all using (organization_id is null or public.user_in_org(organization_id))
with check (organization_id is null or public.user_in_org(organization_id));

create policy "members access materials" on public.materials
for all using (organization_id is null or public.user_in_org(organization_id))
with check (organization_id is null or public.user_in_org(organization_id));

create policy "members access supplier prices" on public.supplier_prices
for all using (
  exists (
    select 1 from public.materials m
    where m.id = material_id and (m.organization_id is null or public.user_in_org(m.organization_id))
  )
) with check (
  exists (
    select 1 from public.materials m
    where m.id = material_id and (m.organization_id is null or public.user_in_org(m.organization_id))
  )
);

create policy "members access apu resources" on public.apu_resources
for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));

create policy "members access quotes" on public.quotes
for all using (public.user_in_org(organization_id)) with check (public.user_in_org(organization_id));

create policy "members access quote items" on public.quote_items
for all using (
  exists (select 1 from public.quotes q where q.id = quote_id and public.user_in_org(q.organization_id))
) with check (
  exists (select 1 from public.quotes q where q.id = quote_id and public.user_in_org(q.organization_id))
);

create policy "members access price history" on public.price_history
for select using (
  exists (
    select 1 from public.materials m
    where m.id = material_id and (m.organization_id is null or public.user_in_org(m.organization_id))
  )
);

create policy "members view audit log" on public.audit_log
for select using (organization_id is not null and public.user_in_org(organization_id));

-- Bootstrap helper: after first user signs up, create an organization manually or via SQL,
-- then insert that user's auth UID into organization_members with role='owner'.
