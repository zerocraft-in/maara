"use client";

import type { ReactNode } from "react";

export function SettingsLayoutClient({ children }: { children: ReactNode }) {
  return <div className="relative min-w-0">{children}</div>;
}
