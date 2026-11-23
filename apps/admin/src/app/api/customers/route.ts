import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";

type CustomerRow = {
  id: string;
  organization_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  note: string | null;
  tags: string[];
  tax_exempt: boolean;
  accepts_marketing: boolean;
  marketing_opt_in_level: string;
  state: string;
  verified_email: boolean;
  default_address: any;
  addresses: any[];
  orders_count: number;
  total_spent: number;
  last_order_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  try {
    await requirePermission("customers.view");

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organization_id");
    const search = searchParams.get("q") ?? "";
    const state = searchParams.get("state") ?? "";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("page_size")) || 25));
    const sort = searchParams.get("sort") ?? "created_at";
    const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID required" }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    let query = supabase
      .from("customers")
      .select(
        `
        id,
        organization_id,
        email,
        phone,
        first_name,
        last_name,
        note,
        tags,
        tax_exempt,
        accepts_marketing,
        marketing_opt_in_level,
        state,
        verified_email,
        default_address,
        addresses,
        orders_count,
        total_spent,
        last_order_at,
        created_at,
        updated_at
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId);

    // Search across name and email.
    if (search.trim()) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`
      );
    }

    // Filter by state.
    if (state && state !== "all") {
      query = query.eq("state", state);
    }

    // Sort.
    const validSorts = [
      "name",
      "email",
      "orders_count",
      "total_spent",
      "last_order_at",
      "created_at",
    ];
    const sortField = validSorts.includes(sort) ? sort : "created_at";
    const dbSort =
      sortField === "name" ? "last_name" : sortField === "email" ? "email" : sortField;
    query = query.order(dbSort, { ascending: dir === "asc" });

    // Pagination.
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) throw error;

    const customers: CustomerRow[] = (data ?? []).map((c) => ({
      ...c,
      name: `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || c.email || "",
    })) as unknown as CustomerRow[];

    return NextResponse.json({
      customers,
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    });
  } catch (error) {
    console.error("Customers API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load customers" },
      { status: 500 }
    );
  }
}
