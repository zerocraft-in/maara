import Link from "next/link";
import { redirect } from "next/navigation";

import {
  requireOrganization,
  NO_ACTIVE_MEMBERSHIP_ERROR,
} from "@/lib/auth/session";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";

async function requireOrganizationOrRedirect() {
  try {
    return await requireOrganization();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === NO_ACTIVE_MEMBERSHIP_ERROR
    ) {
      redirect("/onboarding");
    }

    throw error;
  }
}

export default async function OrdersPage() {
  return (
    <PageHeader
      actions={
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm">
            Export
          </Button>

          <Button size="sm" render={<Link href="/orders/new" />}>
            Create order
          </Button>
        </div>
      }
    >
      coming soon
    </PageHeader>
  );
}
