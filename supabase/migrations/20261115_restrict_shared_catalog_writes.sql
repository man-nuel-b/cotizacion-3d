-- Restrict shared catalog writes to service-side maintenance.
-- The prior FOR ALL policies also allowed authenticated organization members
-- to INSERT/UPDATE/DELETE global rows (organization_id IS NULL).
-- Existing tenant rows remain editable by members of their own organization.
-- Keep RLS enabled; the policy applies to authenticated API operations.
begin;

drop policy if exists "members access suppliers" on public.suppliers;
create policy "members read suppliers" on public.suppliers
for select to authenticated
using (organization_id is null or public.user_in_org(organization_id));
create policy "members insert own suppliers" on public.suppliers
for insert to authenticated
with check (organization_id is not null and public.user_in_org(organization_id));
create policy "members update own suppliers" on public.suppliers
for update to authenticated
using (organization_id is not null and public.user_in_org(organization_id))
with check (organization_id is not null and public.user_in_org(organization_id));
create policy "members delete own suppliers" on public.suppliers
for delete to authenticated
using (organization_id is not null and public.user_in_org(organization_id));

drop policy if exists "members access materials" on public.materials;
create policy "members read materials" on public.materials
for select to authenticated
using (organization_id is null or public.user_in_org(organization_id));
create policy "members insert own materials" on public.materials
for insert to authenticated
with check (organization_id is not null and public.user_in_org(organization_id));
create policy "members update own materials" on public.materials
for update to authenticated
using (organization_id is not null and public.user_in_org(organization_id))
with check (organization_id is not null and public.user_in_org(organization_id));
create policy "members delete own materials" on public.materials
for delete to authenticated
using (organization_id is not null and public.user_in_org(organization_id));

-- Price rows are tenant-owned only when BOTH the supplier and material
-- belong to the authenticated organization. Prevent cross-tenant references.
-- Shared catalog prices remain readable, but never writable by tenant users.
drop policy if exists "members access supplier prices" on public.supplier_prices;
create policy "members read supplier prices" on public.supplier_prices
for select to authenticated
using (
  exists (select 1 from public.materials m
    where m.id = material_id
      and (m.organization_id is null or public.user_in_org(m.organization_id)))
  and exists (select 1 from public.suppliers s
    where s.id = supplier_id
      and (s.organization_id is null or public.user_in_org(s.organization_id)))
);
create policy "members insert own supplier prices" on public.supplier_prices
for insert to authenticated
with check (
  exists (select 1 from public.materials m
    where m.id = material_id and m.organization_id is not null
      and public.user_in_org(m.organization_id))
  and exists (select 1 from public.suppliers s
    where s.id = supplier_id and s.organization_id is not null
      and public.user_in_org(s.organization_id))
);
create policy "members update own supplier prices" on public.supplier_prices
for update to authenticated
using (
  exists (select 1 from public.materials m
    where m.id = material_id and m.organization_id is not null
      and public.user_in_org(m.organization_id))
  and exists (select 1 from public.suppliers s
    where s.id = supplier_id and s.organization_id is not null
      and public.user_in_org(s.organization_id))
)
with check (
  exists (select 1 from public.materials m
    where m.id = material_id and m.organization_id is not null
      and public.user_in_org(m.organization_id))
  and exists (select 1 from public.suppliers s
    where s.id = supplier_id and s.organization_id is not null
      and public.user_in_org(s.organization_id))
);
create policy "members delete own supplier prices" on public.supplier_prices
for delete to authenticated
using (
  exists (select 1 from public.materials m
    where m.id = material_id and m.organization_id is not null
      and public.user_in_org(m.organization_id))
  and exists (select 1 from public.suppliers s
    where s.id = supplier_id and s.organization_id is not null
      and public.user_in_org(s.organization_id))
);

commit;
