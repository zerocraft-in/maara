
import type { ReactNode } from "react";

export function DashboardContent({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[1600px] p-5 md:p-6">
        {children}
      </div>
    </main>
  );
}
