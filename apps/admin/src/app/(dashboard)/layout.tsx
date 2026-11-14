import { requireOrganization } from "@/lib/auth/session";
import DashboardShell from "./dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  readonly children: React.ReactNode;
}) {
  const context = await requireOrganization();

  return (
    <DashboardShell permissions={Array.from(context.permissions)}>
      {children}
    </DashboardShell>
  );
}
