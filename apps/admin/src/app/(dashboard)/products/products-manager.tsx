"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Search,
  Filter,
  Plus,
  MoreHorizontal,
  Trash2,
  Eye,
  Edit,
  Package,
  Tag,
  Archive,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  archiveProduct,
  setProductStatus,
  bulkArchiveProducts,
  bulkSetProductStatus,
} from "./actions";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import ProductForm from "./product-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Checkbox,
} from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty";
import { formatPaise, paise } from "@/lib/money";
import type { ProductRow, CategoryOption, StatusFilter, VariantRow } from "./types";

interface ProductsManagerProps {
  organizationId: string;
  permissions: Set<string>;
}

type SortField = "name" | "created_at" | "updated_at" | "status" | "vendor" | "product_type";
type SortDirection = "asc" | "desc";

function formatTax(bps: number): string {
  const percent = bps / 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(2)}%`;
}

function statusBadgeVariant(
  status: string,
): "success" | "warning" | "default" {
  switch (status) {
    case "active":
      return "success";
    case "draft":
      return "warning";
    default:
      return "default";
  }
}

function formatMoney(value: number): string {
  return formatPaise(paise(Number(value)));
}

function getInventoryStatus(variant: VariantRow): {
  status: "in_stock" | "low_stock" | "out_of_stock" | "not_tracked";
  label: string;
} {
  if (!variant.track_quantity) {
    return { status: "not_tracked", label: "Not tracked" };
  }
  if (variant.quantity <= 0) {
    return { status: "out_of_stock", label: "Out of stock" };
  }
  if (variant.quantity <= (variant.reorder_point || 10)) {
    return { status: "low_stock", label: `Low stock (${variant.quantity})` };
  }
  return { status: "in_stock", label: `In stock (${variant.quantity})` };
}

function variantDimensions(variant: VariantRow): string {
  const parts = [variant.option1, variant.option2, variant.option3].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "—";
}

export default function ProductsManager({
  organizationId,
  permissions,
}: ProductsManagerProps) {
  const router = useRouter();
  const canCreate = permissions.has("products.create");
  const canUpdate = permissions.has("products.update");
  const canArchive = permissions.has("products.archive");

  // State
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [vendorFilter, setVendorFilter] = React.useState("");
  const [productTypeFilter, setProductTypeFilter] = React.useState("");
  const [sortField, setSortField] = React.useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = React.useState<SortDirection>("desc");
  const [selectedProducts, setSelectedProducts] = React.useState<string[]>([]);
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingProduct, setEditingProduct] = React.useState<ProductRow | null>(null);
  const [isBulkActionLoading, setIsBulkActionLoading] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [categoriesLoading, setCategoriesLoading] = React.useState(true);

  // Fetch categories
  React.useEffect(() => {
    async function loadCategories() {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, status")
        .eq("organization_id", organizationId)
        .order("name", { ascending: true });
      if (!error && data) {
        setCategories(data as CategoryOption[]);
      }
      setCategoriesLoading(false);
    }
    loadCategories();
  }, [organizationId]);
  const [columnsVisibility, setColumnsVisibility] = React.useState<Record<string, boolean>>({
    image: true,
    title: true,
    vendor: true,
    product_type: true,
    variants: true,
    inventory: true,
    price: true,
    status: true,
    collections: true,
    created_at: true,
  });

  // Fetch products
  const [products, setProducts] = React.useState<ProductRow[]>([]);
  const [vendors, setVendors] = React.useState<string[]>([]);
  const [productTypes, setProductTypes] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function loadProducts() {
      try {
        setLoading(true);
        const response = await fetch(`/api/products?organization_id=${organizationId}`);
        if (!response.ok) throw new Error("Failed to load products");
        const data = await response.json();
        setProducts(data.products);
        setVendors(data.vendors);
        setProductTypes(data.productTypes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load products");
      } finally {
        setLoading(false);
      }
    }
    loadProducts();
  }, [organizationId]);

  // Derived state
  const filteredProducts = React.useMemo(() => {
    return products
      .filter((product) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          query.length === 0 ||
          product.name.toLowerCase().includes(query) ||
          (product.description ?? "").toLowerCase().includes(query) ||
          (product.vendor ?? "").toLowerCase().includes(query) ||
          (product.product_type ?? "").toLowerCase().includes(query) ||
          product.tags.some((tag) => tag.toLowerCase().includes(query)) ||
          product.product_variants.some(
            (variant) =>
              variant.sku.toLowerCase().includes(query) ||
              (variant.barcode ?? "").toLowerCase().includes(query),
          );
        const matchesStatus =
          statusFilter === "all" || product.status === statusFilter;
        const matchesVendor = !vendorFilter || product.vendor === vendorFilter;
        const matchesProductType = !productTypeFilter || product.product_type === productTypeFilter;
        return matchesSearch && matchesStatus && matchesVendor && matchesProductType;
      })
      .sort((a, b) => {
        let aVal: string | number = "";
        let bVal: string | number = "";
        
        switch (sortField) {
          case "name":
            aVal = a.name.toLowerCase();
            bVal = b.name.toLowerCase();
            break;
          case "created_at":
            aVal = new Date(a.created_at).getTime();
            bVal = new Date(b.created_at).getTime();
            break;
          case "updated_at":
            aVal = new Date(a.updated_at).getTime();
            bVal = new Date(b.updated_at).getTime();
            break;
          case "status":
            aVal = a.status;
            bVal = b.status;
            break;
          case "vendor":
            aVal = (a.vendor ?? "").toLowerCase();
            bVal = (b.vendor ?? "").toLowerCase();
            break;
          case "product_type":
            aVal = (a.product_type ?? "").toLowerCase();
            bVal = (b.product_type ?? "").toLowerCase();
            break;
        }
        
        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [products, searchQuery, statusFilter, vendorFilter, productTypeFilter, sortField, sortDirection]);

  const allSelected = filteredProducts.length > 0 && filteredProducts.every((p) => selectedProducts.includes(p.id));
  const someSelected = selectedProducts.length > 0 && !allSelected;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(filteredProducts.map((p) => p.id));
    }
  };

  const handleSelectProduct = (id: string) => {
    setSelectedProducts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkArchive = async () => {
    if (selectedProducts.length === 0) return;
    if (!window.confirm(`Archive ${selectedProducts.length} product(s)?`)) return;

    setIsBulkActionLoading(true);
    try {
      const result = await bulkArchiveProducts({ ids: selectedProducts });
      if (result.ok) {
        toast.success(`${selectedProducts.length} product(s) archived.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsBulkActionLoading(false);
      setSelectedProducts([]);
    }
  };

  const handleBulkStatusChange = async (status: "draft" | "active") => {
    if (selectedProducts.length === 0) return;

    setIsBulkActionLoading(true);
    try {
      const result = await bulkSetProductStatus({ ids: selectedProducts, status });
      if (result.ok) {
        toast.success(`${selectedProducts.length} product(s) set to ${status}.`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setIsBulkActionLoading(false);
      setSelectedProducts([]);
    }
  };

  const handleArchive = async (productId: string) => {
    if (!window.confirm(`Archive "${products.find(p => p.id === productId)?.name}"?`)) return;

    try {
      const result = await archiveProduct({ id: productId });
      if (result.ok) {
        toast.success("Product archived.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to archive product.");
    }
  };

  const handleStatusChange = async (productId: string, status: "draft" | "active") => {
    try {
      const result = await setProductStatus({ id: productId, status });
      if (result.ok) {
        toast.success(status === "active" ? "Product published." : "Product set to draft.");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Failed to change product status.");
    }
  };

  const toggleColumn = (column: string) => {
    setColumnsVisibility((prev) => ({ ...prev, [column]: !prev[column] }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-body">{error}</p>
            <Button onClick={() => router.refresh()} className="mt-4">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand text-[16px] font-bold text-brand-fg"
          >
            <Package className="size-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-[-0.02em] text-body">Products</h1>
            <p className="text-sm text-muted-foreground">
              Manage your products, inventory, and variants
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {/* Bulk actions bar */}
          {selectedProducts.length > 0 && (
            <div className="fixed bottom-4 right-4 z-50 w-full sm:w-auto">
              <Card className="shadow-lg border-destructive">
                <CardContent className="flex items-center gap-3 p-3">
                  <span className="text-sm font-medium">
                    {selectedProducts.length} selected
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        Bulk actions <ChevronDown className="size-4 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleBulkStatusChange("active")}>
                        Publish selected
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleBulkStatusChange("draft")}>
                        Set to draft
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleBulkArchive} className="text-destructive">
                        Archive selected
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedProducts([])}
                  >
                    Clear
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setShowCreateForm(true)}
              disabled={!canCreate}
            >
              <Plus className="size-4 mr-2" />
              Add product
            </Button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4 pb-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>

              {vendors.length > 0 && (
                <Select value={vendorFilter} onValueChange={setVendorFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All vendors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All vendors</SelectItem>
                    {vendors.map((v) => (
                      <SelectItem key={v} value={v}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {productTypes.length > 0 && (
                <Select value={productTypeFilter} onValueChange={setProductTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    {productTypes.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="size-4" />
                    Columns
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 p-2">
                  {[
                    { key: "image", label: "Image" },
                    { key: "title", label: "Title" },
                    { key: "vendor", label: "Vendor" },
                    { key: "product_type", label: "Type" },
                    { key: "variants", label: "Variants" },
                    { key: "inventory", label: "Inventory" },
                    { key: "price", label: "Price" },
                    { key: "status", label: "Status" },
                    { key: "collections", label: "Collections" },
                    { key: "created_at", label: "Created" },
                  ].map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={columnsVisibility[col.key]}
                      onCheckedChange={() => toggleColumn(col.key)}
                    >
                      {col.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow className="text-xs font-medium text-muted-foreground">
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected || someSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all products"
                />
              </TableHead>
              {columnsVisibility.image && <TableHead className="w-16">Image</TableHead>}
              {columnsVisibility.title && (
                <TableHead className="min-w-[200px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto p-0 text-left gap-1"
                    onClick={() => handleSort("name")}
                  >
                    Title
                    {sortField === "name" && (
                      sortDirection === "asc" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
                    )}
                  </Button>
                </TableHead>
              )}
              {columnsVisibility.vendor && (
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto p-0 text-left gap-1"
                    onClick={() => handleSort("vendor")}
                  >
                    Vendor
                    {sortField === "vendor" && (
                      sortDirection === "asc" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
                    )}
                  </Button>
                </TableHead>
              )}
              {columnsVisibility.product_type && (
                <TableHead className="w-[150px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto p-0 text-left gap-1"
                    onClick={() => handleSort("product_type")}
                  >
                    Type
                    {sortField === "product_type" && (
                      sortDirection === "asc" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
                    )}
                  </Button>
                </TableHead>
              )}
              {columnsVisibility.variants && <TableHead className="w-[120px]">Variants</TableHead>}
              {columnsVisibility.inventory && <TableHead className="w-[150px]">Inventory</TableHead>}
              {columnsVisibility.price && <TableHead className="w-[140px]">Price</TableHead>}
              {columnsVisibility.status && (
                <TableHead className="w-[140px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto p-0 text-left gap-1"
                    onClick={() => handleSort("status")}
                  >
                    Status
                    {sortField === "status" && (
                      sortDirection === "asc" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
                    )}
                  </Button>
                </TableHead>
              )}
              {columnsVisibility.collections && <TableHead className="w-[150px]">Collections</TableHead>}
              {columnsVisibility.created_at && (
                <TableHead className="w-[140px]">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-auto p-0 text-left gap-1"
                    onClick={() => handleSort("created_at")}
                  >
                    Created
                    {sortField === "created_at" && (
                      sortDirection === "asc" ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />
                    )}
                  </Button>
                </TableHead>
              )}
              <TableHead className="w-32 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={20} className="py-12">
                  <Empty className="border-0 p-0">
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <Package className="size-12 text-muted-foreground/50" />
                      </EmptyMedia>
                      <EmptyTitle>No products found</EmptyTitle>
                      <EmptyDescription>
                        {searchQuery || statusFilter !== "all"
                          ? "Try adjusting your search or filters."
                          : "Get started by adding your first product."}
                      </EmptyDescription>
                    </EmptyHeader>
                    {canCreate && !searchQuery && statusFilter === "all" && (
                      <EmptyContent>
                        <Button onClick={() => setShowCreateForm(true)}>
                          <Plus className="size-4 mr-2" />
                          Add product
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => {
                const firstImage = product.product_images[0];
                const activeVariants = product.product_variants.filter((v) => v.is_active).length;
                const totalInventory = product.product_variants.reduce((sum, v) => sum + (v.track_quantity ? v.quantity : 0), 0);
                const hasLowStock = product.product_variants.some(
                  (v) => v.track_quantity && v.quantity > 0 && v.quantity <= (v.reorder_point || 10)
                );
                const hasOutOfStock = product.product_variants.some(
                  (v) => v.track_quantity && v.quantity <= 0
                );

                return (
                  <TableRow key={product.id} className="hover:bg-muted/50">
                    <TableCell className="p-3">
                      <Checkbox
                        checked={selectedProducts.includes(product.id)}
                        onCheckedChange={() => handleSelectProduct(product.id)}
                        aria-label={`Select ${product.name}`}
                      />
                    </TableCell>

                    {columnsVisibility.image && (
                      <TableCell className="p-3">
                        {firstImage ? (
                          <img
                            src={firstImage.src}
                            alt={firstImage.alt ?? product.name}
                            className="w-10 h-10 rounded object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                            <Package className="size-5 text-muted-foreground" />
                          </div>
                        )}
                      </TableCell>
                    )}

                    {columnsVisibility.title && (
                      <TableCell className="p-3">
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
                      </TableCell>
                    )}

                    {columnsVisibility.vendor && (
                      <TableCell className="p-3 text-muted-foreground">
                        {product.vendor ?? "—"}
                      </TableCell>
                    )}

                    {columnsVisibility.product_type && (
                      <TableCell className="p-3 text-muted-foreground">
                        {product.product_type ?? "—"}
                      </TableCell>
                    )}

                    {columnsVisibility.variants && (
                      <TableCell className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{activeVariants}</span>
                          {product.product_variants.length > activeVariants && (
                            <Badge variant="outline" className="text-xs">
                              {product.product_variants.length - activeVariants} inactive
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {columnsVisibility.inventory && (
                      <TableCell className="p-3">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{totalInventory}</span>
                          <div className="flex gap-1">
                            {hasOutOfStock && (
                              <Badge variant="danger" className="text-[10px] h-4 px-1.5">
                                Out of stock
                              </Badge>
                            )}
                            {hasLowStock && !hasOutOfStock && (
                              <Badge variant="warning" className="text-[10px] h-4 px-1.5">
                                Low stock
                              </Badge>
                            )}
                            {!hasOutOfStock && !hasLowStock && totalInventory > 0 && (
                              <Badge variant="success" className="text-[10px] h-4 px-1.5">
                                In stock
                              </Badge>
                            )}
                            {totalInventory === 0 && !product.product_variants.some(v => v.track_quantity) && (
                              <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                Not tracked
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                    )}

                    {columnsVisibility.price && (
                      <TableCell className="p-3">
                        {product.product_variants.length > 0 ? (
                          <>
                            <p className="font-medium text-body">
                              {formatMoney(Math.min(...product.product_variants.map(v => v.selling_price_paise)))}
                            </p>
                            {product.product_variants.some(v => v.compare_at_price_paise) && (
                              <p className="text-xs text-muted-foreground line-through">
                                {formatMoney(Math.min(...product.product_variants.filter(v => v.compare_at_price_paise).map(v => v.compare_at_price_paise!)))}
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}

                    {columnsVisibility.status && (
                      <TableCell className="p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={statusBadgeVariant(product.status)}>
                            {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
                          </Badge>
                          {product.published_at && (
                            <span className="text-xs text-muted-foreground">
                              Published {new Date(product.published_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {columnsVisibility.collections && (
                      <TableCell className="p-3 text-muted-foreground">
                        {product.collections.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {product.collections.slice(0, 3).map((c) => (
                              <Badge key={c.id} variant="outline" className="text-xs">
                                {c.title}
                              </Badge>
                            ))}
                            {product.collections.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{product.collections.length - 3} more
                              </Badge>
                            )}
                          </div>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}

                    {columnsVisibility.created_at && (
                      <TableCell className="p-3 text-muted-foreground">
                        {new Date(product.created_at).toLocaleDateString()}
                      </TableCell>
                    )}

                    <TableCell className="p-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={() => router.push(`/products/${product.id}`)}
                            className="flex items-center gap-2"
                          >
                            <Eye className="size-4" />
                            View
                          </DropdownMenuItem>
                          {canUpdate && (
                            <DropdownMenuItem
                              onClick={() => setEditingProduct(product)}
                              className="flex items-center gap-2"
                            >
                              <Edit className="size-4" />
                              Edit
                            </DropdownMenuItem>
                          )}
                          {canUpdate && product.status === "draft" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(product.id, "active")}
                              className="flex items-center gap-2"
                            >
                              Publish
                            </DropdownMenuItem>
                          )}
                          {canUpdate && product.status === "active" && (
                            <DropdownMenuItem
                              onClick={() => handleStatusChange(product.id, "draft")}
                              className="flex items-center gap-2"
                            >
                              Set to draft
                            </DropdownMenuItem>
                          )}
                          {canArchive && product.status !== "archived" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleArchive(product.id)}
                                className="flex items-center gap-2 text-destructive focus:text-destructive"
                              >
                                <Archive className="size-4" />
                                Archive
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination would go here */}

      {/* Create/Edit Product Form Modal */}
      {showCreateForm && canCreate && (
        <ProductForm
          mode="create"
          organizationId={organizationId}
          categories={categories}
          onSuccess={() => {
            setShowCreateForm(false);
            toast.success("Product created successfully.");
            router.refresh();
          }}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {editingProduct && canUpdate && (
        <ProductForm
          mode="edit"
          organizationId={organizationId}
          categories={categories}
          product={editingProduct}
          onSuccess={() => {
            setEditingProduct(null);
            toast.success("Product updated successfully.");
            router.refresh();
          }}
          onClose={() => setEditingProduct(null)}
        />
      )}
    </div>
  );
}