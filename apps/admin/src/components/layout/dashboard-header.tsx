
"use client";

import { Menu, Search } from "lucide-react";
import { ThemeSwitcher } from "@/components/layout/theme-switcher";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

type Props = {
  title: string;
  onMobileMenu: () => void;
  onSearch?: () => void;
};

export function DashboardHeader({
  title,
  onMobileMenu,
  onSearch,
}: Props) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border px-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden"
          onClick={onMobileMenu}
          aria-label="Open navigation"
        >
          <Menu className="size-4" />
        </Button>

        <h1 className="text-sm font-semibold tracking-tight">
          {title}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onSearch}
          className="hidden gap-2 text-muted-foreground sm:flex"
        >
          <Search className="size-4" />
          <span className="text-xs">Search</span>
          <Kbd>⌘K</Kbd>
        </Button>

        <ThemeSwitcher />
      </div>
    </header>
  );
}
