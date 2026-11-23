-- Tranche 2 security hardening.
-- This migration is intentionally not applied by the agent. It closes two
-- defense-in-depth gaps found during static RLS and SECURITY DEFINER review.

begin;

-- The registry is internal and direct grants are revoked, but RLS provides a
-- second barrier if grants or API exposure change in a future migration.
alter table public.product_public_id_registry enable row level security;
revoke all on table public.product_public_id_registry from public, anon, authenticated;

-- SECURITY DEFINER functions must not resolve attacker-controlled objects from
-- public or pg_temp. Built-ins are explicitly qualified where needed.
create or replace function public.generate_product_public_id()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate bigint;
begin
  loop
    candidate := 1000000000000 + pg_catalog.floor(pg_catalog.random() * 9000000000000)::bigint;

    begin
      insert into public.product_public_id_registry(public_id)
      values (candidate);
      return candidate;
    exception
      when unique_violation then
        null;
    end;
  end loop;
end;
$$;

do $$
begin
  if to_regprocedure('private.user_locations_compat_write()') is not null then
    alter function private.user_locations_compat_write() set search_path = '';
  end if;
end;
$$;

commit;
