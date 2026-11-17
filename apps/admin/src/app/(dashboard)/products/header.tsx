"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "cn";
import { Eye, Package, Plus } from "lucide-react";

interface ProductsHeaderProps {
  className?: string;
  canCreate?: boolean;
  onAddProduct?: () => void;
  onImport?: () => void;
  onExport?: () => void;
}

export function ProductsHeader({
  className,
  canCreate = true,
  onAddProduct,
  onImport,
  onExport,
}: ProductsHeaderProps) {
  const router = useRouter();

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-center ">
        <div
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-[16px] font-bold text-brand-fg"
        >
          <Package className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-[-0.02em] text-body">
            Products
          </h1>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center gap-2">
   
        <Button variant="outline" size="sm" onClick={onImport}>
          Import
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          Export
        </Button>
        <Button
          size="sm"
          disabled={!canCreate}
          onClick={() => {
            onAddProduct?.();
            router.push("/products/new");
          }}
        >
          <Plus className="size-4 mr-1.5" />
          Add product
        </Button>
      </div>
    </div>
  );
}
