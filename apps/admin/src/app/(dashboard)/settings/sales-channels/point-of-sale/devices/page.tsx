import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DevicesClient } from "../devices-client";

export default async function PosDevicesPage() {
  const context = await requirePermission("sales_channels.view");
  const supabase = await createServerSupabaseClient();
  const [{ data: devices }, { data: locations }] = await Promise.all([
    supabase.from("pos_devices").select("id,name,device_type,status,last_seen_at,registered_at,location_id").eq("organization_id", context.activeOrganization!.id).order("registered_at", { ascending: false }),
    supabase.from("locations").select("id,name,code").eq("organization_id", context.activeOrganization!.id).eq("status", "active").order("name"),
  ]);
  return <DevicesClient devices={devices ?? []} locations={locations ?? []} canManage={context.permissions.has("sales_channels.manage")} />;
}
