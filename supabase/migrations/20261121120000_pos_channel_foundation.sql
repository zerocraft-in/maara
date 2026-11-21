-- POS channel persistence: devices, cash register sessions, and settings.

create table public.pos_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  name text not null,
  device_type text not null default 'tablet' check (device_type in ('tablet', 'phone', 'terminal', 'unknown')),
  status text not null default 'offline' check (status in ('online', 'offline', 'deactivated')),
  last_seen_at timestamptz,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, name)
);

create table public.pos_register_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  location_id uuid references public.locations(id) on delete set null,
  opened_by uuid references auth.users(id) on delete set null,
  closed_by uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opening_cash_minor bigint not null default 0 check (opening_cash_minor >= 0),
  cash_activity_minor bigint not null default 0,
  closing_cash_minor bigint check (closing_cash_minor is null or closing_cash_minor >= 0),
  discrepancy_minor bigint,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pos_register_sessions_one_open_per_location
  on public.pos_register_sessions (organization_id, location_id)
  where status = 'open';
create index pos_devices_org_status on public.pos_devices (organization_id, status);
create index pos_register_sessions_org_opened_at on public.pos_register_sessions (organization_id, opened_at desc);

create table public.pos_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  language text not null default 'en',
  recent_carts_retention_hours integer not null default 24 check (recent_carts_retention_hours in (1, 4, 12, 24, 48, 72)),
  return_policy_enabled boolean not null default false,
  allow_store_credit boolean not null default false,
  require_return_reasons boolean not null default false,
  updated_at timestamptz not null default now()
);

create or replace function private.set_pos_defaults()
returns trigger language plpgsql as $$
begin
  insert into public.pos_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

-- Settings are created lazily by the settings page; no organization trigger is required.

create trigger pos_devices_updated_at
  before update on public.pos_devices
  for each row execute function public.set_updated_at();
create trigger pos_register_sessions_updated_at
  before update on public.pos_register_sessions
  for each row execute function public.set_updated_at();
create trigger pos_settings_updated_at
  before update on public.pos_settings
  for each row execute function public.set_updated_at();

revoke all on table public.pos_devices, public.pos_register_sessions, public.pos_settings from anon;
revoke all on table public.pos_devices, public.pos_register_sessions, public.pos_settings from authenticated;
grant select, insert, update on table public.pos_devices to authenticated;
grant select, insert, update on table public.pos_register_sessions to authenticated;
grant select, insert, update on table public.pos_settings to authenticated;

alter table public.pos_devices enable row level security;
alter table public.pos_register_sessions enable row level security;
alter table public.pos_settings enable row level security;

create policy "pos_devices_select" on public.pos_devices for select to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.view')));
create policy "pos_devices_manage_insert" on public.pos_devices for insert to authenticated
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));
create policy "pos_devices_manage_update" on public.pos_devices for update to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.manage')))
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));

create policy "pos_sessions_select" on public.pos_register_sessions for select to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.view')));
create policy "pos_sessions_manage_insert" on public.pos_register_sessions for insert to authenticated
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));
create policy "pos_sessions_manage_update" on public.pos_register_sessions for update to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.manage')))
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));

create policy "pos_settings_select" on public.pos_settings for select to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.view')));
create policy "pos_settings_manage_insert" on public.pos_settings for insert to authenticated
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));
create policy "pos_settings_manage_update" on public.pos_settings for update to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.manage')))
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));
