"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/session";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const deviceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  deviceType: z.enum(["tablet", "phone", "terminal", "unknown"]),
  locationId: z.string().uuid().nullable(),
});

const sessionSchema = z.object({
  locationId: z.string().uuid().nullable(),
  openingCashMinor: z.number().int().min(0).max(100_000_000),
  notes: z.string().trim().max(500).nullable(),
});

const settingsSchema = z.object({
  language: z.string().min(2).max(10),
  recentCartsRetentionHours: z.number().int().refine((value) => [1, 4, 12, 24, 48, 72].includes(value)),
  returnPolicyEnabled: z.boolean(),
  allowStoreCredit: z.boolean(),
  requireReturnReasons: z.boolean(),
});

export type PosActionResult = { ok: true } | { ok: false; error: string };

export async function registerPosDevice(input: unknown): Promise<PosActionResult> {
  const context = await requirePermission("sales_channels.manage");
  const parsed = deviceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid device name and type." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("pos_devices").insert({
    organization_id: context.activeOrganization!.id,
    name: parsed.data.name,
    device_type: parsed.data.deviceType,
    location_id: parsed.data.locationId,
    status: "offline",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "A device with this name already exists." };
    console.error("POS device registration failed.", { code: error.code, message: error.message });
    return { ok: false, error: "Unable to register the POS device." };
  }
  revalidatePath("/settings/sales-channels/point-of-sale/devices");
  return { ok: true };
}

export async function openPosRegisterSession(input: unknown): Promise<PosActionResult> {
  const context = await requirePermission("sales_channels.manage");
  const parsed = sessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid opening cash amount." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("pos_register_sessions").insert({
    organization_id: context.activeOrganization!.id,
    location_id: parsed.data.locationId,
    opened_by: context.user.id,
    opening_cash_minor: parsed.data.openingCashMinor,
    notes: parsed.data.notes,
    status: "open",
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "This location already has an open register session." };
    console.error("POS register opening failed.", { code: error.code, message: error.message });
    return { ok: false, error: "Unable to open the register session." };
  }
  revalidatePath("/settings/sales-channels/point-of-sale/register-sessions");
  return { ok: true };
}

export async function closePosRegisterSession(input: unknown): Promise<PosActionResult> {
  const context = await requirePermission("sales_channels.manage");
  const parsed = z.object({ id: z.string().uuid(), closingCashMinor: z.number().int().min(0).max(100_000_000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid closing cash amount." };

  const supabase = await createServerSupabaseClient();
  const { data: session, error: readError } = await supabase
    .from("pos_register_sessions")
    .select("opening_cash_minor, cash_activity_minor")
    .eq("id", parsed.data.id)
    .eq("organization_id", context.activeOrganization!.id)
    .eq("status", "open")
    .maybeSingle();
  if (readError || !session) return { ok: false, error: "Open register session was not found." };

  const expectedCash = session.opening_cash_minor + session.cash_activity_minor;
  const { error } = await supabase.from("pos_register_sessions").update({
    status: "closed",
    closed_by: context.user.id,
    closed_at: new Date().toISOString(),
    closing_cash_minor: parsed.data.closingCashMinor,
    discrepancy_minor: parsed.data.closingCashMinor - expectedCash,
  }).eq("id", parsed.data.id).eq("organization_id", context.activeOrganization!.id);
  if (error) return { ok: false, error: "Unable to close the register session." };
  revalidatePath("/settings/sales-channels/point-of-sale/register-sessions");
  return { ok: true };
}

export async function updatePosSettings(input: unknown): Promise<PosActionResult> {
  const context = await requirePermission("sales_channels.manage");
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid POS settings." };

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("pos_settings").upsert({
    organization_id: context.activeOrganization!.id,
    language: parsed.data.language,
    recent_carts_retention_hours: parsed.data.recentCartsRetentionHours,
    return_policy_enabled: parsed.data.returnPolicyEnabled,
    allow_store_credit: parsed.data.allowStoreCredit,
    require_return_reasons: parsed.data.requireReturnReasons,
  });
  if (error) return { ok: false, error: "Unable to save POS settings." };
  revalidatePath("/settings/sales-channels/point-of-sale/settings");
  return { ok: true };
}
