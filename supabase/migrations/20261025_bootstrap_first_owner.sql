create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  v_org_id uuid;
  v_member_count integer;
  v_name text;
begin
  v_name := nullif(trim(coalesce(new.raw_user_meta_data->>'full_name','')), '');

  insert into public.profiles(id, full_name)
  values (new.id, v_name)
  on conflict (id) do nothing;

  select count(*) into v_member_count from public.organization_members;
  if v_member_count = 0 then
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

    insert into public.organization_members(organization_id, user_id, role)
    values (v_org_id, new.id, 'owner')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger if exists bat_first_user_bootstrap on auth.users;
create trigger bat_first_user_bootstrap
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function public.bootstrap_current_user(display_name text default null)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_org_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set full_name = coalesce(nullif(trim(display_name), ''), full_name),
      updated_at = now()
  where id = v_uid;

  select organization_id into v_org_id
  from public.organization_members
  where user_id = v_uid
  limit 1;

  if v_org_id is null then
    raise exception 'No organization access. Ask an administrator for access.';
  end if;

  return v_org_id;
end;
$$;

revoke all on function public.bootstrap_current_user(text) from public, anon;
grant execute on function public.bootstrap_current_user(text) to authenticated;