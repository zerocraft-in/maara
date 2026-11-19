
"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";

type NavSubItem = {
  title: string;
  url: string;
};

type NavItem = {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  section?: string;
  items?: NavSubItem[];
};

interface NavMainProps {
  items: NavItem[];
}

export function NavMain({ items }: NavMainProps) {
  const pathname = usePathname();

  const isRouteActive = React.useCallback(
    (url: string) => {
      return pathname === url || pathname.startsWith(`${url}/`);
    },
    [pathname]
  );

  return (
    <SidebarGroup className="px-2">
      <SidebarGroupLabel className="sr-only">Main navigation</SidebarGroupLabel>

      <SidebarMenu>
        {items.map((item) => {
          const Icon = item.icon;
          const hasSubItems = Boolean(item.items?.length);

          const isChildActive = item.items?.some((subItem) =>
            isRouteActive(subItem.url)
          );

          const isActive =
            isRouteActive(item.url) || Boolean(isChildActive);

          // Single child: Navigate directly.
          if (item.items?.length === 1) {
            const child = item.items[0];
            const childIsActive = isRouteActive(child.url);

            return (
              <React.Fragment key={item.title}>
                {item.section && <NavSectionLabel>{item.section}</NavSectionLabel>}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href={child.url} aria-current={childIsActive ? "page" : undefined} />}
                    isActive={childIsActive}
                    tooltip={item.title}
                    className="text-white/85 data-active:bg-white/12 data-active:text-white data-active:font-semibold hover:bg-white/8 hover:text-white"
                  >
                    {Icon && <Icon />}
                    <span>{child.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </React.Fragment>
            );
          }

          // No children: Regular navigation.
          if (!hasSubItems) {
            return (
              <React.Fragment key={item.title}>
                {item.section && <NavSectionLabel>{item.section}</NavSectionLabel>}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href={item.url} aria-current={isRouteActive(item.url) ? "page" : undefined} />}
                    isActive={isRouteActive(item.url)}
                    tooltip={item.title}
                    className="text-white/85 data-active:bg-white/12 data-active:text-white data-active:font-semibold hover:bg-white/8 hover:text-white"
                  >
                    {Icon && <Icon />}
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </React.Fragment>
            );
          }

          // Multiple children: Controlled Collapsible.
          return (
            <React.Fragment key={item.title}>
              {item.section && <NavSectionLabel>{item.section}</NavSectionLabel>}
              <NavCollapsibleItem
                item={item}
                isActive={isActive}
                isChildActive={Boolean(isChildActive)}
                Icon={Icon}
                isRouteActive={isRouteActive}
              />
            </React.Fragment>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function NavSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li className="mt-4 flex h-7 items-center px-2 text-xs font-medium text-white/55 first:mt-1 group-data-[collapsible=icon]:hidden">
      <span>{children}</span>
      <ChevronRight className="ml-1 size-3.5" />
    </li>
  );
}

interface NavCollapsibleItemProps {
  item: NavItem;
  isActive: boolean;
  isChildActive: boolean;
  Icon?: LucideIcon;
  isRouteActive: (url: string) => boolean;
}

function NavCollapsibleItem({
  item,
  isActive,
  isChildActive,
  Icon,
  isRouteActive,
}: NavCollapsibleItemProps) {
  const { state, toggleSidebar } = useSidebar();
  const [open, setOpen] = React.useState(
    () => Boolean(item.isActive || isChildActive)
  );

  // Automatically open when a child route becomes active.
  React.useEffect(() => {
    if (isChildActive) {
      setOpen(true);
    }
  }, [isChildActive]);

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="group/collapsible"
    >
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActive}
              className="text-white/85 data-active:bg-white/12 data-active:text-white data-active:font-semibold hover:bg-white/8 hover:text-white"
              onClick={(event) => {
                if (state === "collapsed") {
                  event.preventDefault();
                  toggleSidebar();
                }
              }}
            >
              {Icon && <Icon />}

              <span>{item.title}</span>

              <ChevronRight
                className="
                  ml-auto
                  size-4
                  shrink-0
                  group-data-[collapsible=icon]:hidden
                  transition-transform
                  duration-200
                  group-data-open/collapsible:rotate-90
                "
              />
            </SidebarMenuButton>
          }
        />

        <CollapsibleContent>
          <SidebarMenuSub className="mx-0 translate-x-0 border-l-0 px-0 py-0.5 pl-6">
            {item.items?.map((subItem) => {
              const subItemIsActive = isRouteActive(subItem.url);

              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    render={<Link href={subItem.url} aria-current={subItemIsActive ? "page" : undefined} />}
                    isActive={subItemIsActive}
                    size="sm"
                    className="text-white/65 data-active:bg-white/10 data-active:text-white hover:bg-white/8 hover:text-white"
                  >
                    <span className="truncate">
                      {subItem.title}
                    </span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
