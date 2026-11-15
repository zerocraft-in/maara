
import type { ReactNode } from "react";
import { SettingsSidebar } from "@/components/layout/settings-sidebar";

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-8 lg:flex-row lg:gap-12">
      <SettingsSidebar />

      <div className="min-w-0 flex-1">
        {children}
      </div>
    </div>
  );
}
