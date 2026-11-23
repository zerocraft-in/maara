"use server";

import { z } from "zod";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";

export type CustomerResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

// ============================================================================
// Schemas
// ============================================================================

const customerBaseSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(1, "First name is required")
    .max(100, "First name must be at most 100 characters")
    .optional(),
  last_name: z
    .string()
    .trim()
    .min(1, "Last name is required")
    .max(100, "Last name must be at most 100 characters")
    .optional(),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .max(320, "Email must be at most 320 characters")
    .email("Enter a valid email address")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .max(32, "Phone must be at most 32 characters")
    .optional()
    .or(z.literal("")),
  note: z
    .string()
    .trim()
    .max(5000, "Note must be at most 5000 characters")
    .optional()
    .or(z.literal("")),
  tags: z
    .array(z.string().trim().min(1))
    .max(100, "Too many tags")
    .default([]),
  tax_exempt: z.boolean().default(false),
  accepts_marketing: z.boolean().default(false),
  marketing_opt_in_level: z
    .enum(["unknown", "single_opt_in", "confirmed_opt_in", "unconfirmed_opt_in"])
    .default("unknown"),
  state: z.enum(["enabled", "disabled", "invited", "declined"]).default("enabled"),
  verified_email: z.boolean().default(false),
  default_address: z
    .object({
      first_name: z.string().trim().optional(),
      last_name: z.string().trim().optional(),
      company: z.string().trim().optional(),
      address1: z.string().trim().optional(),
      address2: z.string().trim().optional(),
      city: z.string().trim().optional(),
      state: z.string().trim().optional(),
      province: z.string().trim().optional(),
      country: z.string().trim().optional(),
      zip: z.string().trim().optional(),
      phone: z.string().trim().optional(),
    })
    .nullable()
    .optional(),
  addresses: z
    .array(
      z.object({
        first_name: z.string().trim().optional(),
        last_name: z.string().trim().optional(),
        company: z.string().trim().optional(),
        address1: z.string().trim().optional(),
        address2: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        province: z.string().trim().optional(),
        country: z.string().trim().optional(),
        zip: z.string().trim().optional(),
        phone: z.string().trim().optional(),
      })
    )
    .default([]),
});

// Normalize tags: trim and deduplicate.
function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      result.push(trimmed);
    }
  }
  return result;
}

// Normalize email: empty string becomes null.
function normalizeEmail(email: string | undefined): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

// Normalize phone: empty string becomes null.
function normalizePhone(phone: string | undefined): string | null {
  if (!phone) return null;
  return phone.trim();
}

// ============================================================================
// Create customer
// ============================================================================

export async function createCustomer(
  input: unknown
): Promise<CustomerResult> {
  const context = await requirePermission("customers.manage");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = customerBaseSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid customer data.",
    };
  }

  const data = parseResult.data;

  const email = normalizeEmail(data.email);
  const phone = normalizePhone(data.phone);
  const tags = normalizeTags(data.tags);

  // Prevent duplicate email within the same organization.
  if (email) {
    const supabase = await createServerSupabaseClient();
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organization.id)
      .ilike("email", email)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "A customer with this email already exists." };
    }
  }

  const supabase = await createServerSupabaseClient();

  const { data: inserted, error } = await supabase
    .from("customers")
    .insert({
      organization_id: organization.id,
      email,
      phone,
      first_name: data.first_name ?? null,
      last_name: data.last_name ?? null,
      note: data.note ?? null,
      tags,
      tax_exempt: data.tax_exempt,
      accepts_marketing: data.accepts_marketing,
      marketing_opt_in_level: data.marketing_opt_in_level,
      state: data.state,
      verified_email: data.verified_email,
      default_address: data.default_address ?? null,
      addresses: data.addresses,
      orders_count: 0,
      total_spent: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error(
      `Customer creation failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    if (error.code === "23505") {
      return { ok: false, error: "A customer with this email already exists." };
    }
    return { ok: false, error: "Unable to create customer. Please try again." };
  }

  revalidatePath("/customers");
  return { ok: true, id: inserted.id };
}

// ============================================================================
// Update customer
// ============================================================================

const customerUpdateSchema = customerBaseSchema.extend({
  id: z.string().uuid("Invalid customer ID."),
});

export async function updateCustomer(
  input: unknown
): Promise<CustomerResult> {
  const context = await requirePermission("customers.manage");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = customerUpdateSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid customer data.",
    };
  }

  const { id, ...rest } = parseResult.data;

  const email = normalizeEmail(rest.email);
  const phone = normalizePhone(rest.phone);
  const tags = normalizeTags(rest.tags);

  // Prevent duplicate email within the same organization (excluding self).
  if (email) {
    const supabase = await createServerSupabaseClient();
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("organization_id", organization.id)
      .ilike("email", email)
      .neq("id", id)
      .maybeSingle();

    if (existing) {
      return { ok: false, error: "A customer with this email already exists." };
    }
  }

  const supabase = await createServerSupabaseClient();

  // Verify the customer belongs to the caller's organization.
  const { data: current } = await supabase
    .from("customers")
    .select("id, organization_id")
    .eq("id", id)
    .single();

  if (!current || current.organization_id !== organization.id) {
    return { ok: false, error: "Customer not found." };
  }

  const { error } = await supabase
    .from("customers")
    .update({
      email,
      phone,
      first_name: rest.first_name ?? null,
      last_name: rest.last_name ?? null,
      note: rest.note ?? null,
      tags,
      tax_exempt: rest.tax_exempt,
      accepts_marketing: rest.accepts_marketing,
      marketing_opt_in_level: rest.marketing_opt_in_level,
      state: rest.state,
      verified_email: rest.verified_email,
      default_address: rest.default_address ?? null,
      addresses: rest.addresses,
    })
    .eq("id", id);

  if (error) {
    console.error(
      `Customer update failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to update customer. Please try again." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

// ============================================================================
// Archive / disable customer (set state to 'disabled')
// ============================================================================

const archiveCustomerSchema = z.object({
  id: z.string().uuid("Invalid customer ID."),
});

export async function archiveCustomer(
  input: unknown
): Promise<CustomerResult> {
  const context = await requirePermission("customers.manage");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = archiveCustomerSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid customer ID.",
    };
  }

  const { id } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  // Verify the customer belongs to the caller's organization.
  const { data: current } = await supabase
    .from("customers")
    .select("id, organization_id, state")
    .eq("id", id)
    .single();

  if (!current || current.organization_id !== organization.id) {
    return { ok: false, error: "Customer not found." };
  }

  if (current.state === "disabled") {
    return { ok: false, error: "Customer is already disabled." };
  }

  const { error } = await supabase
    .from("customers")
    .update({ state: "disabled" })
    .eq("id", id);

  if (error) {
    console.error(
      `Customer archive failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to disable customer. Please try again." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}

// ============================================================================
// Enable customer (set state to 'enabled')
// ============================================================================

const enableCustomerSchema = z.object({
  id: z.string().uuid("Invalid customer ID."),
});

export async function enableCustomer(
  input: unknown
): Promise<CustomerResult> {
  const context = await requirePermission("customers.manage");
  const organization = context.activeOrganization;
  if (!organization) {
    return { ok: false, error: "No active organization." };
  }

  const parseResult = enableCustomerSchema.safeParse(input);
  if (!parseResult.success) {
    return {
      ok: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid customer ID.",
    };
  }

  const { id } = parseResult.data;

  const supabase = await createServerSupabaseClient();

  const { data: current } = await supabase
    .from("customers")
    .select("id, organization_id, state")
    .eq("id", id)
    .single();

  if (!current || current.organization_id !== organization.id) {
    return { ok: false, error: "Customer not found." };
  }

  const { error } = await supabase
    .from("customers")
    .update({ state: "enabled" })
    .eq("id", id);

  if (error) {
    console.error(
      `Customer enable failed. code=${error.code ?? "-"} message=${error.message}`,
    );
    return { ok: false, error: "Unable to enable customer. Please try again." };
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  return { ok: true };
}
