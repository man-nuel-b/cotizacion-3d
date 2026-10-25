create or replace function public.bootstrap_current_user(display_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_existing_members integer;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  select organization_id into v_org_id
  from public.organization_members
  where user_id = v_uid
  limit 1;

  if v_org_id is not null then
    return v_org_id;
  end if;

  select count(*) into v_existing_members from public.organization_members;
  if v_existing_members > 0 then
    raise exception 'Organization already initialized. Ask an administrator for access.';
  end if;

  select id into v_org_id
  from public.organizations
  where name = 'BAT-Cubikeitor'
  order by created_at asc
  limit 1;

  if v_org_id is null then
    insert into public.organizations(name)
    values ('BAT-Cubikeitor')
    returning id into v_org_id;
  end if;

  insert into public.profiles(id, full_name)
  values (v_uid, nullif(trim(display_name), ''))
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name),
      updated_at = now();

  insert into public.organization_members(organization_id, user_id, role)
  values (v_org_id, v_uid, 'owner');

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_current_user(text) from public;
revoke all on function public.bootstrap_current_user(text) from anon;
grant execute on function public.bootstrap_current_user(text) to authenticated;