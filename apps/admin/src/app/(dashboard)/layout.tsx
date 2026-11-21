import { requireOrganization } from "@/lib/auth/session";
import DashboardShell from "@/components/layout/dashboard-shell";
import { DirtyProvider } from "@/components/providers/dirty-provider";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const context = await requireOrganization();

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
