import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SalesChannelsManager } from "./sales-channels-manager";

export default async function SalesChannelsPage() {
  const context = await requirePermission("sales_channels.view");
  const supabase = await createServerSupabaseClient();

  const [
    { data: channels, error: channelsError },
    { data: installations, error: installationsError },
  ] = await Promise.all([
    supabase
      .from("sales_channels")
      .select("id, key, name, description, channel_type, provider, icon")
      .order("name"),
    supabase
      .from("channel_installations")
      .select(
        "sales_channel_id, status, billing_status, billing_amount_minor, billing_currency, installed_at, connected_at",
      )
      .eq("organization_id", context.activeOrganization!.id),
  ]);

  if (channelsError || installationsError) {
    console.error("Sales channels query failed.", {
      channels: channelsError?.message,
      installations: installationsError?.message,
    });
  }

  return (
    <SalesChannelsManager
      channels={channels ?? []}
      installations={installations ?? []}
      canManage={context.permissions.has("sales_channels.manage")}
    />
  );
}
