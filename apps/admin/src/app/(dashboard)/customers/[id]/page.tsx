import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  requirePermission,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";

import { PageHeader } from "@/components/layout/page-header";
import { CustomerDetail } from "./client-detail";
import { customerDisplayName } from "../types";

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
  name: string;
};

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  try {
    await requireOrganization();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === NO_ACTIVE_MEMBERSHIP_ERROR
    ) {
      redirect("/onboarding");
    }
    throw error;
  }

  const context = await requirePermission("customers.view");
  const organizationId = context.activeOrganization?.id;
  if (!organizationId) {
    redirect("/onboarding");
  }

  const canManage = context.permissions.has("customers.manage");

  const supabase = await createServerSupabaseClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", organizationId)
    .single();

  if (error || !customer) {
    redirect("/customers");
  }

  const customerRow: CustomerRow = {
    ...customer,
    name: customerDisplayName(customer as any),
  };

  return (
    <PageHeader>
      <CustomerDetail
        customer={customerRow}
        canManage={canManage}
      />
    </PageHeader>
  );
}
