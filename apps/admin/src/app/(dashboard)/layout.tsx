import { requireOrganization } from "@/lib/auth/session";
import DashboardShell from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const context = await requireOrganization();

  return (
   <div className="min-h-dvh bg-background">
      <DashboardShell
        user={context.user}
        memberships={context.memberships}
        activeOrganization={context.activeOrganization}
      >
      {children}
    </DashboardShell>
   </div>
  );
}
