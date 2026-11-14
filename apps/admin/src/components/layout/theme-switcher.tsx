"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-inset p-0.5",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={active}
            aria-label={`${label} theme`}
            title={`${label} theme`}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-sm text-meta transition-colors",
              "hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
              active && "bg-card text-foreground shadow-xs",
            )}
          >
            <Icon className="size-3.5" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}
