"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ProgressProps
  extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
}

export function Progress({ className, value, ...props }: ProgressProps) {
  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full border",
        className,
      )}
      {...props}
    >
      <div
        className="flex-1 overflow-hidden bg-primary"
        style={{
          transform: `scaleX(${value ?? 0 / 100})`,
          transformOrigin: "left",
        }}
      >
        <span className="sr-only">{value ?? 0}%</span>
      </div>
    </div>
  );
}
