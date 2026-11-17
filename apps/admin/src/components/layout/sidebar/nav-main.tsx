
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
    <SidebarGroup>
      <SidebarGroupLabel>Platform</SidebarGroupLabel>

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
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<Link href={child.url} />}
                  isActive={childIsActive}
                  tooltip={item.title}
                >
                  {Icon && <Icon />}
                  <span>{child.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          // No children: Regular navigation.
          if (!hasSubItems) {
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  render={<Link href={item.url} />}
                  isActive={isRouteActive(item.url)}
                  tooltip={item.title}
                >
                  {Icon && <Icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          }

          // Multiple children: Controlled Collapsible.
          return (
            <NavCollapsibleItem
              key={item.title}
              item={item}
              isActive={isActive}
              isChildActive={Boolean(isChildActive)}
              Icon={Icon}
              isRouteActive={isRouteActive}
            />
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
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
            >
              {Icon && <Icon />}

              <span>{item.title}</span>

              <ChevronRight
                className="
                  ml-auto
                  size-4
                  shrink-0
                  transition-transform
                  duration-200
                  group-data-open/collapsible:rotate-90
                "
              />
            </SidebarMenuButton>
          }
        />

        <CollapsibleContent>
          <SidebarMenuSub>
            {item.items?.map((subItem) => {
              const subItemIsActive = isRouteActive(subItem.url);

              return (
                <SidebarMenuSubItem key={subItem.title}>
                  <SidebarMenuSubButton
                    render={<Link href={subItem.url} />}
                    isActive={subItemIsActive}
                    size="sm"
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
