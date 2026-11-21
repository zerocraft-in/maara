import { requireOrganization, NO_ACTIVE_MEMBERSHIP_ERROR } from "@/lib/auth/session";
import DashboardShell from "@/components/layout/dashboard-shell";
import { DirtyProvider } from "@/components/providers/dirty-provider";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  let context;
  try {
    context = await requireOrganization();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Unauthenticated → login. No active membership → onboarding.
    if (message === NO_ACTIVE_MEMBERSHIP_ERROR) {
      redirect("/onboarding");
    }
    redirect("/login");
  }

  return (
    <DirtyProvider>
      <DashboardShell
        user={context.user}
        memberships={context.memberships}
        activeOrganization={context.activeOrganization}
      >
        {children}
      </DashboardShell>
    </DirtyProvider>
  );
}
