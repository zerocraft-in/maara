import { createColumnHelper } from "@tanstack/react-table";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Archive, Edit, Eye } from "lucide-react";

import type { ProductRow, VariantRow } from "./types";

export type ProductColumnCtx = {
  canUpdate: boolean;
  canArchive: boolean;
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onStatusChange: (id: string, status: "draft" | "active") => void;
  onArchive: (id: string, name: string) => void;
  onSelect: (id: string) => void;
  onSelectAll: (checked: boolean) => void;
  isSelected: (id: string) => boolean;
  allSelected: boolean;
  someSelected: boolean;
};

const columnHelper = createColumnHelper<ProductRow>();

function formatMoney(value: number): string {
  return `${(value / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function statusBadgeVariant(status: string): "success" | "warning" | "default" {
  switch (status) {
    case "active":
      return "success";
    case "draft":
      return "warning";
    default:
      return "default";
  }
}

function getInventoryStatus(variants: VariantRow[]): {
  status: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked";
  label: string;
} {
  const trackQuantity = variants.some((v) => v.track_quantity);
  if (!trackQuantity) {
    return { status: "not_tracked", label: "Not tracked" };
  }
  if (variants.some((v) => v.quantity <= 0)) {
    return { status: "out_of_stock", label: "Out of stock" };
  }
  if (
    variants.some(
      (v) => v.quantity > 0 && v.quantity <= (v.reorder_point || 10),
    )
  ) {
    return { status: "low_stock", label: "Low stock" };
  }
  return { status: "in_stock", label: "In stock" };
}

export function buildColumns(ctx: ProductColumnCtx) {
  const {
    canUpdate,
    canArchive,
    onView,
    onEdit,
    onStatusChange,
    onArchive,
    onSelect,
    onSelectAll,
    isSelected,
    allSelected,
    someSelected,
  } = ctx;

  return [
    columnHelper.accessor("id", {
      id: "selection",
      header: () => (
        <Checkbox
          checked={allSelected || someSelected}
          onCheckedChange={(checked) => onSelectAll(!!checked)}
          aria-label="Select all products"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={isSelected(row.original.id)}
          onCheckedChange={() => onSelect(row.original.id)}
          aria-label={`Select ${row.original.name}`}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    }),
    columnHelper.accessor("id", {
      id: "image",
      header: "Image",
      cell: ({ row }) => {
        const firstImage = row.original.product_images[0];
        return (
          <div className="flex size-10 items-center justify-center rounded bg-muted">
            {firstImage ? (
              <img
                src={firstImage.src}
                alt={firstImage.alt ?? row.original.name}
                className="size-10 rounded object-cover"
                loading="lazy"
              />
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("name", {
      id: "title",
      header: "Title",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="min-w-0">
            <p className="font-medium text-body truncate">{product.name}</p>
            {product.handle && (
              <p className="text-xs text-muted-foreground font-mono truncate">
                /{product.handle}
              </p>
            )}
            {product.product_type && (
              <Badge variant="outline" className="mt-1 text-xs">
                {product.product_type}
              </Badge>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor("vendor", {
      id: "vendor",
      header: "Vendor",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue() ?? "—"}</span>
      ),
    }),
    columnHelper.accessor("product_type", {
      id: "product_type",
      header: "Type",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue() ?? "—"}</span>
      ),
    }),
    columnHelper.accessor("product_variants", {
      id: "variants",
      header: "Variants",
      cell: ({ row }) => {
        const variants = row.original.product_variants;
        const active = variants.filter((v) => v.is_active).length;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{active}</span>
            {variants.length > active && (
              <Badge variant="outline" className="text-xs">
                {variants.length - active} inactive
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("product_variants", {
      id: "inventory",
      header: "Inventory",
      cell: ({ row }) => {
        const variants = row.original.product_variants;
        const total = variants.reduce(
          (sum, v) => sum + (v.track_quantity ? v.quantity : 0),
          0,
        );
        const status = getInventoryStatus(variants);
        let variant: BadgePropsVariant = "outline";
        switch (status.status) {
          case "in_stock":
            variant = "success";
            break;
          case "low_stock":
            variant = "warning";
            break;
          case "out_of_stock":
            variant = "destructive";
            break;
          default:
            variant = "outline";
        }
        return (
          <div className="flex flex-col gap-1">
            <span className="font-medium">{total}</span>
            <Badge variant={variant} className="text-[10px] h-4 px-1.5">
              {status.label}
            </Badge>
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("product_variants", {
      id: "price",
      header: "Price",
      cell: ({ row }) => {
        const variants = row.original.product_variants;
        if (variants.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        const minPrice = Math.min(...variants.map((v) => v.selling_price_paise));
        const comparePrices = variants
          .map((v) => v.compare_at_price_paise)
          .filter((v): v is number => v !== null);
        return (
          <div className="flex flex-col gap-1">
            <p className="font-medium text-body">
              {formatMoney(minPrice)}
            </p>
            {comparePrices.length > 0 && (
              <p className="text-xs text-muted-foreground line-through">
                {formatMoney(Math.min(...comparePrices))}
              </p>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("status", {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center gap-2">
            <Badge variant={statusBadgeVariant(product.status)}>
              {product.status.charAt(0).toUpperCase() +
                product.status.slice(1)}
            </Badge>
            {product.published_at && (
              <span className="text-xs text-muted-foreground">
                Published{" "}
                {new Date(product.published_at).toLocaleDateString()}
              </span>
            )}
          </div>
        );
      },
    }),
    columnHelper.accessor("collections", {
      id: "collections",
      header: "Collections",
      cell: ({ row }) => {
        const collections = row.original.collections;
        if (collections.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {collections.slice(0, 3).map((c) => (
              <Badge key={c.id} variant="outline" className="text-xs">
                {c.title}
              </Badge>
            ))}
            {collections.length > 3 && (
              <Badge variant="outline" className="text-xs">
                +{collections.length - 3} more
              </Badge>
            )}
          </div>
        );
      },
      enableSorting: false,
    }),
    columnHelper.accessor("created_at", {
      id: "created_at",
      header: "Created",
      cell: ({ getValue }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {new Date(getValue() as string).toLocaleDateString()}
        </span>
      ),
    }),
    columnHelper.accessor("id", {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => {
        const product = row.original;
        return (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onView(product.id)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body hover:bg-muted transition-colors"
              aria-label={`View ${product.name}`}
            >
              <Eye className="size-4" />
            </button>
            {canUpdate && (
              <button
                onClick={() => onEdit(product.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body hover:bg-muted transition-colors"
                aria-label={`Edit ${product.name}`}
              >
                <Edit className="size-4" />
              </button>
            )}
            {canUpdate &&
              (product.status === "draft" ? (
                <button
                  onClick={() => onStatusChange(product.id, "active")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body hover:bg-muted transition-colors"
                  aria-label={`Publish ${product.name}`}
                >
                  <span className="sr-only">Publish</span>
                </button>
              ) : (
                <button
                  onClick={() => onStatusChange(product.id, "draft")}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-body hover:bg-muted transition-colors"
                  aria-label={`Set ${product.name} to draft`}
                >
                  <span className="sr-only">Draft</span>
                </button>
              ))}
            {canArchive && product.status !== "archived" && (
              <button
                onClick={() => onArchive(product.id, product.name)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                aria-label={`Archive ${product.name}`}
              >
                <Archive className="size-4" />
              </button>
            )}
          </div>
        );
      },
      enableSorting: false,
      enableHiding: false,
    }),
  ];
}

type BadgePropsVariant = "default" | "success" | "warning" | "destructive" | "outline";
