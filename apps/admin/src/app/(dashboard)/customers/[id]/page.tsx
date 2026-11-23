import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  requireOrganization,
  requirePermission,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";

import { PageHeader } from "@/components/layout/page-header";
import { CustomerDetail } from "./client-detail";
import { CustomerRow, customerDisplayName } from "../types";

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
    name: customerDisplayName(customer),
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
