"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  NAV_GROUPS,
  FOOTER_ITEMS,
  isNavActive,
  type NavChild,
  type NavGroup,
} from "./dashboard-nav";

type Props = {
  open: boolean;
  onToggle: () => void;
  permissions: string[];
  email?: string | null;
  onLogout: () => void;
  onSearch?: () => void;
};

const COLLAPSED_ICON_OFFSET = "pl-[19px]";

/** Base classes shared by every sidebar row button. */
const rowBase = cn(
  "flex h-10 w-full shrink-0 items-center gap-3 rounded-lg",
  "pl-2 pr-2 text-sm transition-[background-color,color,padding] duration-300 ease-in-out",
  "outline-none focus-visible:ring-2 focus-visible:ring-ring",
);

function filterChildren(group: NavGroup, permissions: string[]): NavChild[] {
  return group.children.filter((c) => permissions.includes(c.permission));
}

export function GlobalSidebar({
  open,
  onToggle,
  permissions,
  email,
  onLogout,
  onSearch,
}: Props) {
  const pathname = usePathname();
  const router = useRouter();

  /** Expandable groups currently open (expanded mode). */
  const [openGroups, setOpenGroups] = React.useState<Set<string>>(
    () => new Set(),
  );
  /** Group whose flyout popover is open (collapsed mode). */
  const [popoverGroup, setPopoverGroup] = React.useState<string | null>(null);

  // Auto-expand a group when one of its child routes is active.
  React.useEffect(() => {
    const next = new Set<string>();
    for (const group of NAV_GROUPS) {
      const visible = filterChildren(group, permissions);
      if (visible.length > 1 && visible.some((c) => isNavActive(pathname, c.href))) {
        next.add(group.id);
      }
    }
    setOpenGroups((prev) => {
      let changed = false;
      for (const id of next) {
        if (!prev.has(id)) {
          changed = true;
          break;
        }
      }
      return changed ? new Set(next) : prev;
    });
  }, [pathname, permissions]);

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const navigate = (href: string) => {
    router.push(href);
    setPopoverGroup(null);
  };

  /** Render a leaf row (direct link) — used for single-child groups and footer. */
  const renderLeaf = (item: NavChild, opts?: { indent?: boolean }) => {
    const Icon = item.icon;
    const active = isNavActive(pathname, item.href);

    return (
      <button
        key={item.href}
        type="button"
        onClick={() => navigate(item.href)}
        title={!open ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        className={cn(
          rowBase,
          !open && COLLAPSED_ICON_OFFSET,
          opts?.indent && "pl-[38px]",
          !opts?.indent && "justify-start",
          active
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )}
      >
        <Icon className="size-[18px] shrink-0" aria-hidden="true" />
        {open && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  /** Render an expandable parent group + its children (expanded mode only). */
  const renderGroup = (group: NavGroup) => {
    const visible = filterChildren(group, permissions);
    if (visible.length === 0) return null;

    // Single-child groups render as direct links (no disclosure control).
    if (visible.length === 1) return renderLeaf(visible[0]);

    const Icon = group.icon;
    const isOpen = openGroups.has(group.id);
    const hasActiveChild = visible.some((c) => isNavActive(pathname, c.href));

    // Collapsed rail: icon opens a flyout popover listing the children.
    if (!open) {
      return (
        <Popover
          key={group.id}
          open={popoverGroup === group.id}
          onOpenChange={(o) => setPopoverGroup(o ? group.id : null)}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={group.label}
              aria-expanded={popoverGroup === group.id}
              title={group.label}
              className={cn(
                rowBase,
                COLLAPSED_ICON_OFFSET,
                "justify-start",
                hasActiveChild || popoverGroup === group.id
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="right"
            align="start"
            sideOffset={8}
            className="w-56 p-1"
          >
            <p className="px-2 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            {visible.map((child) => {
              const ChildIcon = child.icon;
              const active = isNavActive(pathname, child.href);
              return (
                <button
                  key={child.href}
                  type="button"
                  onClick={() => navigate(child.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-2 text-sm",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <ChildIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{child.label}</span>
                </button>
              );
            })}
          </PopoverContent>
        </Popover>
      );
    }

    // Expanded: parent disclosure row + indented children.
    return (
      <div key={group.id}>
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={isOpen}
          aria-controls={`nav-group-${group.id}`}
          className={cn(
            rowBase,
            "justify-start",
            hasActiveChild
              ? "font-medium text-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
        >
          <Icon className="size-[18px] shrink-0" aria-hidden="true" />
          <span className="truncate">{group.label}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {isOpen && (
          <div id={`nav-group-${group.id}`} className="mt-0.5 space-y-0.5">
            {visible.map((child) => {
              const ChildIcon = child.icon;
              const active = isNavActive(pathname, child.href);
              return (
                <button
                  key={child.href}
                  type="button"
                  onClick={() => navigate(child.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    rowBase,
                    "pl-[38px]",
                    active
                      ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <ChildIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{child.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      className={cn(
        "relative hidden h-full shrink-0 flex-col overflow-hidden",
        "bg-sidebar sm:flex",
        "transition-[width] duration-300 ease-in-out",
        open ? "w-[260px]" : "w-[72px]",
      )}
    >
      {/* Brand — icon only. In collapsed mode the logo itself expands the sidebar. */}
      <div
        className={cn(
          "relative flex h-16 shrink-0 w-full items-center px-3",
          !open && "justify-center",
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={open}
          title={open ? undefined : "Expand sidebar"}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            "bg-brand text-sm font-bold text-brand-fg",
            "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          M
        </button>

        {open && (
          <button
            type="button"
            onClick={onToggle}
            aria-label="Collapse sidebar"
            className={cn(
              "absolute right-2 flex size-6 items-center justify-center rounded-md",
              "text-muted-foreground hover:bg-inset hover:text-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Search */}
      <div className="shrink-0 px-3 pb-3">
        {open ? (
          <InputGroup className="h-9">
            <InputGroupAddon>
              <Search className="size-4" aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              placeholder="Search..."
              onFocus={onSearch}
              onClick={onSearch}
            />
            <InputGroupAddon align="inline-end">
              <Kbd>⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
        ) : (
          <button
            type="button"
            onClick={onSearch}
            aria-label="Search"
            title="Search"
            className={cn(
              "flex size-9 items-center justify-center rounded-md",
              "text-muted-foreground hover:bg-inset hover:text-foreground",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            <Search className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Scrollable navigation */}
      <nav
        aria-label="Main navigation"
        className={cn(
          "min-h-0 w-full flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden px-2 py-2",
        )}
      >
        {NAV_GROUPS.map((group) => renderGroup(group))}
      </nav>

      {/* Bottom — Settings, account, logout (fixed, never scrolls away) */}
      <div className="w-full shrink-0 border-t border-border/60 p-2">
        {FOOTER_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isNavActive(pathname, item.href);
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => navigate(item.href)}
              title={!open ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                rowBase,
                "mb-1 justify-start",
                !open && COLLAPSED_ICON_OFFSET,
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-[18px] shrink-0" aria-hidden="true" />
              {open && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}

        <div
          className={cn(
            "flex h-9 w-full items-center gap-2.5 rounded-lg px-2",
            !open && "justify-center px-0",
          )}
        >
          <div
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-inset text-[10px] font-semibold text-body"
          >
            {email?.charAt(0).toUpperCase() || "?"}
          </div>
          {open && (
            <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-body">
              {email || "User"}
            </p>
          )}
        </div>

        <Button
          variant="ghost"
          onClick={onLogout}
          title={!open ? "Logout" : undefined}
          className={cn(
            "mt-0.5 h-9 w-full justify-start gap-3 rounded-lg px-2 text-xs",
            !open && COLLAPSED_ICON_OFFSET,
          )}
        >
          <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
          {open && "Logout"}
        </Button>
      </div>
    </aside>
  );
}