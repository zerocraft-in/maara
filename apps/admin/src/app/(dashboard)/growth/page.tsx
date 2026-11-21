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

export default async function GrowthPage() {
  return <PageHeader>coming soon</PageHeader>;
}
