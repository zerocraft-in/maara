-- Sales channels foundation: channel catalog, organization installations and
-- product-level publication state. All rows are organization-scoped except
-- the global channel catalogue.

begin;

create table if not exists public.sales_channels (
  id uuid not null default gen_random_uuid() primary key,
  key text not null unique check (key ~ '^[a-z][a-z0-9_-]{1,63}$'),
  name text not null,
  description text null,
  channel_type text not null check (channel_type in ('online', 'pos', 'marketplace', 'embed', 'agentic')),
  provider text not null default 'maara',
  icon text null,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.sales_channels (key, name, description, channel_type, provider, icon)
values
  ('online_store', 'Online Store', 'Sell products through the Maara storefront.', 'online', 'maara', 'store'),
  ('point_of_sale', 'Point of Sale', 'Sell products in person at connected locations.', 'pos', 'maara', 'receipt'),
  ('shop', 'Shop', 'Publish products to the Shop discovery channel.', 'marketplace', 'maara', 'shopping-bag'),
  ('buy_button', 'Buy Button', 'Embed product purchase controls on external sites.', 'embed', 'maara', 'code'),
  ('agentic', 'Agentic', 'Make eligible products discoverable to approved shopping agents.', 'agentic', 'maara', 'sparkles')
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  channel_type = excluded.channel_type,
  provider = excluded.provider,
  icon = excluded.icon,
  updated_at = now();

create table if not exists public.channel_installations (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  status text not null default 'active' check (status in ('available', 'installing', 'active', 'paused', 'error', 'uninstalled')),
  billing_status text not null default 'free' check (billing_status in ('free', 'trial', 'active', 'past_due', 'cancelled')),
  billing_amount_minor bigint not null default 0 check (billing_amount_minor >= 0),
  billing_currency text not null default 'INR' check (char_length(billing_currency) = 3),
  settings jsonb not null default '{}'::jsonb,
  installed_at timestamptz null,
  uninstalled_at timestamptz null,
  connected_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, sales_channel_id)
);

create index if not exists idx_channel_installations_org_status
  on public.channel_installations(organization_id, status);

create table if not exists public.product_channel_publications (
  id uuid not null default gen_random_uuid() primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null,
  sales_channel_id uuid not null references public.sales_channels(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft', 'validating', 'published', 'unpublished', 'blocked', 'error')),
  blocked_reason text null,
  validation_errors jsonb not null default '[]'::jsonb,
  published_at timestamptz null,
  unpublished_at timestamptz null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id, sales_channel_id),
  constraint product_channel_publications_product_fk
    foreign key (product_id, organization_id)
    references public.products(id, organization_id)
    on delete cascade
);

create index if not exists idx_product_channel_publications_org_status
  on public.product_channel_publications(organization_id, status);
create index if not exists idx_product_channel_publications_product
  on public.product_channel_publications(organization_id, product_id);

create or replace trigger sales_channels_updated_at
  before update on public.sales_channels
  for each row execute function public.updated_at_trigger();

create or replace trigger channel_installations_updated_at
  before update on public.channel_installations
  for each row execute function public.updated_at_trigger();

create or replace trigger product_channel_publications_updated_at
  before update on public.product_channel_publications
  for each row execute function public.updated_at_trigger();

alter table public.sales_channels enable row level security;
alter table public.channel_installations enable row level security;
alter table public.product_channel_publications enable row level security;

drop policy if exists sales_channels_select_authenticated on public.sales_channels;
create policy sales_channels_select_authenticated
  on public.sales_channels for select to authenticated using (true);

drop policy if exists channel_installations_select_member on public.channel_installations;
create policy channel_installations_select_member
  on public.channel_installations for select to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.view')));

drop policy if exists channel_installations_insert_manage on public.channel_installations;
create policy channel_installations_insert_manage
  on public.channel_installations for insert to authenticated
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));

drop policy if exists channel_installations_update_manage on public.channel_installations;
create policy channel_installations_update_manage
  on public.channel_installations for update to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.manage')))
  with check (organization_id in (select private.authorized_org_ids('sales_channels.manage')));

drop policy if exists channel_installations_delete_manage on public.channel_installations;
create policy channel_installations_delete_manage
  on public.channel_installations for delete to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.manage')));

drop policy if exists product_channel_publications_select_member on public.product_channel_publications;
create policy product_channel_publications_select_member
  on public.product_channel_publications for select to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.view')));

drop policy if exists product_channel_publications_insert_publish on public.product_channel_publications;
create policy product_channel_publications_insert_publish
  on public.product_channel_publications for insert to authenticated
  with check (organization_id in (select private.authorized_org_ids('sales_channels.publish')));

drop policy if exists product_channel_publications_update_publish on public.product_channel_publications;
create policy product_channel_publications_update_publish
  on public.product_channel_publications for update to authenticated
  using (organization_id in (select private.authorized_org_ids('sales_channels.publish')))
  with check (organization_id in (select private.authorized_org_ids('sales_channels.publish')));

revoke all on public.sales_channels from public, anon;
revoke all on public.channel_installations from public, anon, authenticated;
revoke all on public.product_channel_publications from public, anon, authenticated;
grant select on public.sales_channels to authenticated;
grant select, insert, update, delete on public.channel_installations to authenticated;
grant select, insert, update on public.product_channel_publications to authenticated;

insert into public.permissions (key, "group", description) values
  ('sales_channels.view', 'Administration', 'View sales channels and publication status'),
  ('sales_channels.manage', 'Administration', 'Install, pause and configure sales channels'),
  ('sales_channels.publish', 'Catalogue', 'Publish and unpublish products to sales channels')
on conflict (key) do nothing;

insert into public.role_permissions (role_id, permission_key)
select r.id, p.key
from public.roles r
cross join public.permissions p
where p.key like 'sales_channels.%'
  and r.key in ('owner', 'admin');

commit;
