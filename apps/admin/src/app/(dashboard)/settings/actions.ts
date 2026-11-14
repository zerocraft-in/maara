"use server"

import { z } from "zod"

import { createServerSupabaseClient } from "@/lib/supabase/server"
import { requirePermission } from "@/lib/auth/session"

export type UpdateOrganizationResult =
  | { ok: true }
  | { ok: false; error: string }

const updateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Organization name must be at least 2 characters").max(120, "Organization name must be at most 120 characters"),
  timezone: z.string().trim().min(1, "Timezone is required"),
  gstin: z.string().trim().max(15, "GSTIN is too long").optional().or(z.literal("")),
  phone: z.string().trim().max(20, "Phone is too long").optional().or(z.literal("")),
  email: z.string().email("Enter a valid email address").max(254, "Email is too long").optional().or(z.literal("")),
  invoice_prefix: z.string().trim().min(1, "Invoice prefix is required").max(20, "Invoice prefix is too long"),
  tax_inclusive_pricing: z.boolean(),
})

function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz }).format()
    return true
  } catch {
    return false
  }
}

function isValidGSTIN(gstin: string): boolean {
  const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{1}[Z]{1}[0-9A-Z]{1}$/
  return gstinPattern.test(gstin)
}

function isValidInvoicePrefix(prefix: string): boolean {
  return /^[A-Za-z0-9-]+$/.test(prefix)
}

export async function updateOrganization(
  input: unknown,
): Promise<UpdateOrganizationResult> {
  // 1. Require authenticated caller with settings.manage permission.
  const context = await requirePermission("settings.manage")

  // 2. Resolve organization exclusively from the verified session.
  const organization = context.activeOrganization
  if (!organization) {
    return { ok: false, error: "No active organization." }
  }
  const organizationId = organization.id

  // 3. Validate input.
  const parseResult = updateOrganizationSchema.safeParse(input)
  if (!parseResult.success) {
    return { ok: false, error: parseResult.error.issues[0]?.message ?? "Invalid organization data." }
  }

  const { name, timezone, gstin, phone, email, invoice_prefix, tax_inclusive_pricing } = parseResult.data

  // Additional validation checks
  if (!isValidTimezone(timezone)) {
    return { ok: false, error: "Invalid timezone." }
  }

  if (gstin && !isValidGSTIN(gstin)) {
    return { ok: false, error: "Invalid GSTIN format." }
  }

  if (!isValidInvoicePrefix(invoice_prefix)) {
    return { ok: false, error: "Invoice prefix can only contain letters, numbers, and hyphens." }
  }

  // 4. Call the authenticated Supabase client.
  const supabase = await createServerSupabaseClient()

  // 5. Update only the allowed columns.
  const { data, error } = await supabase
    .from("organizations")
    .update({
      name,
      timezone,
      gstin: gstin || null,
      phone: phone || null,
      email: email || null,
      invoice_prefix,
      tax_inclusive_pricing,
    })
    .eq("id", organizationId)
    .select("id")
    .maybeSingle()

  if (error) {
    // Only the error code and message are logged — never tokens or keys.
    console.error("Organization update failed.", {
      code: error.code,
      message: error.message,
    })

    if (error.code === "42501") {
      return {
        ok: false,
        error: "Your account is not allowed to update organization settings. Contact your administrator.",
      }
    }

    return { ok: false, error: "Unable to save organization settings. Please try again." }
  }

  if (!data) {
    // The row was not written: row level security filtered it out.
    console.error("Organization update wrote no row.", { organizationId })
    return { ok: false, error: "Unable to save organization settings. Please try again." }
  }

  // Re-render /settings so the page immediately shows the saved values.
  const { revalidatePath } = await import("next/cache")
  revalidatePath("/settings")

  return { ok: true }
}
