import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PosSettingsClient } from "../settings-client";

export default async function PosSettingsPage() {
  const context = await requirePermission("sales_channels.view");
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("pos_settings").select("language,recent_carts_retention_hours,return_policy_enabled,allow_store_credit,require_return_reasons").eq("organization_id", context.activeOrganization!.id).maybeSingle();
  return <PosSettingsClient settings={data ?? { language: "en", recent_carts_retention_hours: 24, return_policy_enabled: false, allow_store_credit: false, require_return_reasons: false }} canManage={context.permissions.has("sales_channels.manage")} />;
}
