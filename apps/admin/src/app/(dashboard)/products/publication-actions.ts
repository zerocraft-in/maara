"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const publicationSchema = z.object({
  productId: z.string().uuid(),
  channelKeys: z.array(z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/)).max(32),
});

export type PublicationResult = { ok: true } | { ok: false; error: string };

export async function syncProductChannelPublications(input: unknown): Promise<PublicationResult> {
  const context = await requirePermission("sales_channels.publish");
  const parsed = publicationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid publishing selection." };

  const organizationId = context.activeOrganization!.id;
  const supabase = await createServerSupabaseClient();
  const [{ data: product }, { data: channels }, { data: existing }] = await Promise.all([
    supabase.from("products").select("id").eq("id", parsed.data.productId).eq("organization_id", organizationId).maybeSingle(),
    supabase.from("sales_channels").select("id,key").in("key", parsed.data.channelKeys),
    supabase.from("product_channel_publications").select("id,sales_channel_id,status").eq("product_id", parsed.data.productId).eq("organization_id", organizationId),
  ]);

  if (!product) return { ok: false, error: "Product not found." };
  if (!channels) return { ok: false, error: "Unable to load sales channels." };

  const channelIds = channels.map((channel) => channel.id);
  const { data: installations, error: installationError } = await supabase
    .from("channel_installations")
    .select("sales_channel_id,status")
    .eq("organization_id", organizationId)
    .in("sales_channel_id", channelIds)
    .in("status", ["active", "paused"]);
  if (installationError) return { ok: false, error: "Unable to validate installed channels." };

  const installedIds = new Set((installations ?? []).map((installation) => installation.sales_channel_id));
  const requestedIds = new Set(channels.filter((channel) => installedIds.has(channel.id)).map((channel) => channel.id));
  const now = new Date().toISOString();

  const rows = Array.from(requestedIds).map((salesChannelId) => ({
    organization_id: organizationId,
    product_id: parsed.data.productId,
    sales_channel_id: salesChannelId,
    status: "published" as const,
    published_at: now,
    unpublished_at: null,
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("product_channel_publications").upsert(rows, { onConflict: "organization_id,product_id,sales_channel_id" });
    if (error) return { ok: false, error: "Unable to publish the product to the selected channels." };
  }

  const existingRows = (existing ?? []).filter((row) => !requestedIds.has(row.sales_channel_id));
  for (const row of existingRows) {
    const { error } = await supabase.from("product_channel_publications").update({ status: "unpublished", unpublished_at: now }).eq("id", row.id).eq("organization_id", organizationId);
    if (error) return { ok: false, error: "Unable to unpublish the product from a channel." };
  }

  revalidatePath(`/products/${parsed.data.productId}`);
  revalidatePath("/products");
  return { ok: true };
}
