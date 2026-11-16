"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { createProduct } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { slugify } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Plus } from "lucide-react";
import type { CategoryOption } from "../types";

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  handle: z.string().trim().max(255).optional().or(z.literal("")),
  vendor: z.string().trim().max(100).optional().or(z.literal("")),
  product_type: z.string().trim().max(100).optional().or(z.literal("")),
  tags: z.array(z.string()).default([]),
  category_id: z.string().uuid().nullable(),
  tax_rate_percent: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/)
    .refine((v) => Number(v) <= 100)
    .optional()
    .or(z.literal("")),
  is_tax_inclusive: z.boolean(),
  requires_shipping: z.boolean(),
  weight_grams: z.string().optional().or(z.literal("")),
  weight_unit: z.enum(["g", "kg", "oz", "lb"]).default("g"),
  hs_code: z.string().trim().max(20).optional().or(z.literal("")),
  country_of_origin: z.string().trim().length(2).optional().or(z.literal("")),
  seo_title: z.string().trim().max(70).optional().or(z.literal("")),
  seo_description: z.string().trim().max(320).optional().or(z.literal("")),
  published_scope: z.enum(["web", "global"]).default("web"),
  status: z.enum(["draft", "active"]),
  options: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(50),
        values: z.array(z.string().trim().min(1).max(50)),
      }),
    )
    .max(3)
    .default([]),
});

export default function NewProductPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      description: "",
      handle: "",
      vendor: "",
      product_type: "",
      tags: [],
      category_id: null,
      tax_rate_percent: "",
      is_tax_inclusive: false,
      requires_shipping: true,
      weight_grams: "",
      weight_unit: "g",
      hs_code: "",
      country_of_origin: "",
      seo_title: "",
      seo_description: "",
      published_scope: "web",
      status: "active",
      options: [],
    },
  });

  const watchName = form.watch("name");
  const watchHandle = form.watch("handle");

  React.useEffect(() => {
    if (!watchHandle && watchName) {
      form.setValue("handle", slugify(watchName), { shouldDirty: false });
    }
  }, [watchName, watchHandle, form]);

  React.useEffect(() => {
    async function loadData() {
      const supabase = createBrowserSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        router.push("/onboarding");
        return;
      }

      setOrganizationId(membership.organization_id);

      const { data, error } = await supabase
        .from("categories")
        .select("id, name, status")
        .eq("organization_id", membership.organization_id)
        .order("name", { ascending: true });

      if (!error && data) {
        setCategories(data as CategoryOption[]);
      }
      setLoading(false);
    }

    loadData();
  }, [router]);

  const onSubmit = async (values: z.infer<typeof productSchema>) => {
    setIsSubmitting(true);
    try {
      const taxRateBps = Math.round(Number(values.tax_rate_percent) * 100);
      const weightGrams = values.weight_grams
        ? parseInt(values.weight_grams)
        : null;

      const payload = {
        name: values.name,
        description: values.description,
        handle: values.handle || slugify(values.name),
        vendor: values.vendor || null,
        product_type: values.product_type || null,
        tags: values.tags,
        category_id: values.category_id,
        tax_rate_bps: taxRateBps,
        is_tax_inclusive: values.is_tax_inclusive,
        requires_shipping: values.requires_shipping,
        weight_grams: weightGrams,
        weight_unit: values.weight_unit,
        hs_code: values.hs_code || null,
        country_of_origin: values.country_of_origin || null,
        seo_title: values.seo_title || null,
        seo_description: values.seo_description || null,
        published_scope: values.published_scope,
        status: values.status,
        options: values.options.filter(
          (o) => o.name && o.values.some((v) => v),
        ),
      };

      const result = await createProduct(payload);

      if (result.ok) {
        toast.success("Product created successfully.");
        router.push("/products");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !organizationId) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-body">
          Add product
        </h1>
      </div>

      <form
        id="product-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="lg:grid lg:grid-cols-4 lg:gap-8"
      >
        {/* Left column - main form */}
        <div className="space-y-8 lg:col-span-3">
          {/* Title */}
          <Card>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="name">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  {...form.register("name")}
                  placeholder="Short sleeve t-shirt"
                  className="text-lg"
                />
                {form.formState.errors.name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Description */}
          <Card>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <div className="relative">
                  <div className="absolute top-2 left-2 flex gap-1 bg-background p-1 border border-border rounded shadow-sm z-10">
                    <button
                      type="button"
                      className="h-6 w-6 rounded flex items-center justify-center text-xs hover:bg-muted"
                      aria-label="Bold"
                    >
                      B
                    </button>
                    <button
                      type="button"
                      className="h-6 w-6 rounded flex items-center justify-center text-xs hover:bg-muted"
                      aria-label="Italic"
                    >
                      I
                    </button>
                    <button
                      type="button"
                      className="h-6 w-6 rounded flex items-center justify-center text-xs hover:bg-muted"
                      aria-label="Underline"
                    >
                      U
                    </button>
                    <button
                      type="button"
                      className="h-6 w-6 rounded flex items-center justify-center text-xs hover:bg-muted"
                      aria-label="Link"
                    >
                      🔗
                    </button>
                  </div>
                  <Textarea
                    id="description"
                    {...form.register("description")}
                    rows={8}
                    placeholder="Describe your product..."
                    className="pl-10 pt-10 min-h-[200px]"
                  />
                </div>
                {form.formState.errors.description && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Media */}
          <Card>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    Upload new
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Select existing
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepts images, videos, or 3D models
                </p>
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
                  <p className="text-sm">No media added yet</p>
                  <Button variant="outline" size="sm" className="mt-2">
                    Add media
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Category */}
          <Card>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="category_id">Category</Label>
                <Select
                  value={form.watch("category_id") || ""}
                  onValueChange={(v) =>
                    form.setValue("category_id", v || null)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a product category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No category</SelectItem>
                    {categories.map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id}
                        disabled={category.status !== "active"}
                      >
                        {category.name}
                        {category.status !== "active" && " (inactive)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Determines tax rates and adds metafields to improve search,
                  filters, and cross-channel sales.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Price */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Price</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-end">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="flex-1"
                />
                <Button variant="outline" size="sm" className="flex-1">
                  Compare-at
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Unit price
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Charge tax
                </Button>
                <Button variant="outline" size="sm" className="flex-1">
                  Cost per item
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Inventory */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Inventory</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Inventory tracked</p>
                    <p className="text-sm text-muted-foreground">
                      Track quantity for this product
                    </p>
                  </div>
                  <Checkbox defaultChecked />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shop_location">Shop location</Label>
                    <Input id="shop_location" placeholder="0" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs px-3 py-1">
                    SKU
                  </Badge>
                  <Badge variant="outline" className="text-xs px-3 py-1">
                    Barcodes
                  </Badge>
                  <Badge variant="outline" className="text-xs px-3 py-1">
                    Sell when out of stock
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipping */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Shipping</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Physical product</p>
                    <p className="text-sm text-muted-foreground">
                      This product requires shipping
                    </p>
                  </div>
                  <Checkbox defaultChecked />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <div className="flex gap-2">
                      <Input
                        id="weight"
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="0.0"
                        className="flex-1"
                      />
                      <Select defaultValue="g">
                        <SelectTrigger className="w-[80px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="g">g</SelectItem>
                          <SelectItem value="kg">kg</SelectItem>
                          <SelectItem value="oz">oz</SelectItem>
                          <SelectItem value="lb">lb</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hs_code">HS (Harmonized System) code</Label>
                    <Input
                      id="hs_code"
                      placeholder="e.g., 6109.10"
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">
                      Used for international shipping customs.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="country_of_origin">
                      Country/Region of origin
                    </Label>
                    <Input
                      id="country_of_origin"
                      placeholder="ISO code (e.g., IN, US)"
                      maxLength={2}
                      style={{ textTransform: "uppercase" }}
                    />
                    <p className="text-xs text-muted-foreground">
                      ISO 3166-1 alpha-2 code.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Variants */}
          <Card>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 cursor-pointer select-none group">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center group-hover:bg-muted/80 transition-colors">
                    <Plus className="size-4" />
                  </div>
                  <span className="text-sm text-body">
                    Add options like size or color
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Define up to 3 options. Each combination creates a variant.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Product metafields */}
          <Card>
            <CardContent className="flex items-center justify-between">
              <span className="text-sm text-body">Product metafields</span>
              <Button variant="outline" size="sm">Add definition</Button>
            </CardContent>
          </Card>

          {/* Search engine listing */}
          <Card>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2 cursor-pointer group">
                  <p className="text-sm font-medium">
                    Search engine listing
                  </p>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-body group-hover:text-brand"
                  >
                    Edit
                  </button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  Add a title and description to see how this product might
                  appear in a search engine listing
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column - side panel */}
        <div className="space-y-6 lg:col-span-1 lg:sticky lg:top-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={form.watch("status")}
                onValueChange={(v) =>
                  form.setValue("status", v as "draft" | "active")
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Publishing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Publishing</CardTitle>
            </CardHeader>
            <CardContent>
              <Select defaultValue="all">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All channels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Product organization */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">
                Product organization
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="product_type">Type</Label>
                <Select
                  value={form.watch("product_type") ?? ""}
                  onValueChange={(v) =>
                    form.setValue("product_type", v ?? undefined)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendor">Vendor</Label>
                <Select
                  value={form.watch("vendor") ?? ""}
                  onValueChange={(v) => form.setValue("vendor", v ?? undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                type="button"
              >
                <Plus className="size-3" />
                Add collections
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                type="button"
              >
                <Plus className="size-3" />
                Add tags
              </Button>
              <div className="space-y-2">
                <Label>Theme template</Label>
                <Select defaultValue="default">
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Default product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default product</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>
      </form>

      {/* Sticky footer */}
      <div className="mt-8 flex justify-end gap-2 border-t pt-6">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/products")}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-body text-body"
        >
          {isSubmitting ? "Creating..." : "Create product"}
        </Button>
      </div>
    </div>
  );
}
