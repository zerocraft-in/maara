import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { RegisterSessionsClient } from "../register-sessions-client";

export default async function PosRegisterSessionsPage() {
  const context = await requirePermission("sales_channels.view");
  const supabase = await createServerSupabaseClient();
  const [{ data: sessions }, { data: locations }] = await Promise.all([
    supabase.from("pos_register_sessions").select("id,status,opening_cash_minor,cash_activity_minor,closing_cash_minor,discrepancy_minor,opened_at,closed_at,location_id,notes").eq("organization_id", context.activeOrganization!.id).order("opened_at", { ascending: false }),
    supabase.from("locations").select("id,name,code").eq("organization_id", context.activeOrganization!.id).eq("status", "active").order("name"),
  ]);
  return <RegisterSessionsClient sessions={sessions ?? []} locations={locations ?? []} canManage={context.permissions.has("sales_channels.manage")} />;
}
