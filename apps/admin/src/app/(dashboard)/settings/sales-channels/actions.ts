"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type SalesChannelActionResult =
  | { ok: true }
  | { ok: false; error: string };

const installationSchema = z.object({
  channelKey: z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  status: z.enum(["active", "paused", "uninstalled"]),
});

export async function setChannelInstallation(
  input: unknown,
): Promise<SalesChannelActionResult> {
  const context = await requirePermission("sales_channels.manage");
  const parsed = installationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid channel installation." };

  const supabase = await createServerSupabaseClient();
  const { data: channel, error: channelError } = await supabase
    .from("sales_channels")
    .select("id")
    .eq("key", parsed.data.channelKey)
    .maybeSingle();

  if (channelError || !channel) {
    return { ok: false, error: "Sales channel was not found." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase.from("channel_installations").upsert(
    {
      organization_id: context.activeOrganization!.id,
      sales_channel_id: channel.id,
      status: parsed.data.status,
      installed_at: parsed.data.status === "uninstalled" ? null : now,
      connected_at: parsed.data.status === "active" ? now : null,
      uninstalled_at: parsed.data.status === "uninstalled" ? now : null,
    },
    { onConflict: "organization_id,sales_channel_id" },
  );

  if (error) {
    console.error("Sales channel installation update failed.", {
      code: error.code,
      message: error.message,
    });
    return { ok: false, error: "Unable to update the sales channel." };
  }

  revalidatePath("/settings/sales-channels");
  return { ok: true };
}
