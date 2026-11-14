begin;

revoke update on table public.organizations from authenticated;

grant update (
  name,
  timezone,
  gstin,
  phone,
  email,
  invoice_prefix,
  tax_inclusive_pricing
)
on table public.organizations
to authenticated;

comment on column public.organizations.invoice_next_number is
  'Managed internally by invoice numbering logic; not user-editable.';

commit;
