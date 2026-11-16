import { requireOrganization } from "@/lib/auth/session";
import DashboardShell from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const context = await requireOrganization();

  return (
   <div className="bg-background">
      <DashboardShell
        permissions={Array.from(context.permissions)}
        user={context.user}
        memberships={context.memberships}
        activeOrganization={context.activeOrganization}
      >
      {children}
    </DashboardShell>
   </div>
  );
}
