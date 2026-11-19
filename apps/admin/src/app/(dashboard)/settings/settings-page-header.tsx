"use client";

import * as React from "react";
import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

type SettingsPageHeaderProps = {
  title: string;
  className?: string;
};

/** Shopify-style settings heading: large at the top, compact and sticky after scroll. */

export function SettingsPageHeader({
  title,
  className,
}: SettingsPageHeaderProps) {
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
      <div
        aria-hidden={!scrolled}
        className={cn(
          "sticky top-0 z-30 w-full overflow-hidden border-b bg-background/95 backdrop-blur transition-[height,opacity] duration-150 supports-[backdrop-filter]:bg-background/80",
          scrolled
            ? "h-[52px] border-border opacity-100"
            : "h-0 border-transparent opacity-0 pointer-events-none",
          className,
        )}
      >
        <div className="flex h-[52px] w-full items-center gap-2 px-4">
          <Store className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">
            {title}
          </span>
        </div>
      </div>
    </>
  );
}
