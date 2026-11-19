import { Search } from "lucide-react";

import { Label } from "@/components/ui/label";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar";

export function SearchForm({ ...props }: React.ComponentProps<"form">) {
  return (
    <form {...props}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <div className="group-data-[collapsible=icon]:hidden">
            <Label htmlFor="search" className="sr-only">
              Search
            </Label>
            <SidebarInput
              id="search"
              placeholder="Search"
              className="h-8 rounded-lg border-white/15 bg-white/10 pl-9 pr-12 text-sm text-white placeholder:text-white/55 focus-visible:border-white/30 focus-visible:ring-white/20"
            />
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-white/65 select-none" />
            <kbd className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-white/50">
              Ctrl K
            </kbd>
          </div>
          <button
            type="button"
            aria-label="Search"
            className="hidden size-8 items-center justify-center rounded-md text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 group-data-[collapsible=icon]:flex"
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  );
}
