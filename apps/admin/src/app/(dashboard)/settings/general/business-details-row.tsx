"use client";

import * as React from "react";
import { EllipsisVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AboutYourBusinessDrawer } from "./about-your-business-drawer";

type BusinessDetailsRowProps = {
  org: {
    id: string;
    name: string | null;
    country: string | null;
    email: string | null;
    phone: string | null;
    address: Record<string, unknown> | null;
  };
};

export function BusinessDetailsRow({ org }: BusinessDetailsRowProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const router = useRouter();

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 items-center justify-center size-5 rounded-full border border-input">
          <img
            src="https://flagcdn.com/w40/in.png"
            alt="India flag"
            className="size-4 rounded-full object-cover"
          />
        </div>
        <div className="min-w-0 flex flex-col leading-none">
          <span className="font-medium text-foreground">
            {org.name ?? "Maran R"}
          </span>
          <span className="text-xs text-muted-foreground">
            {org.country ?? "India"}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={({ ...triggerProps }) => (
              <Button
                {...triggerProps}
                variant="outline"
                size="icon-sm"
                aria-label="More options"
              >
                <EllipsisVertical className="size-4" />
              </Button>
            )}
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setDrawerOpen(true)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                setDrawerOpen(false);
                router.push("/settings/organization-details");
              }}
            >
              Add entity
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <AboutYourBusinessDrawer
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          org={org}
        />
      </div>
    </div>
  );
}
