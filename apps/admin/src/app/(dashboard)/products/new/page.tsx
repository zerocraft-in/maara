"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { createProduct, createProductImage } from "../actions";
import {
  MediaPicker,
  type PickedMedia,
} from "@/components/media-picker/media-picker";
import { useDirtyForm } from "@/components/providers/dirty-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
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
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { slugify } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Edit,
  Plus,
  Info,
  ChevronDown,
  ChevronUp,
  Barcode,
  ArrowDown,
  CirclePlus,
  ChevronsUpDown,
  AlertTriangle,
  IndianRupee,
} from "lucide-react";
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
  price: z.string().optional().or(z.literal("")),
  compare_at_price: z.string().optional().or(z.literal("")),
  unit_price: z.string().optional().or(z.literal("")),
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

  // All Hooks declared unconditionally at the top level
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [seoOpen, setSeoOpen] = React.useState(false);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [organizationId, setOrganizationId] = React.useState<string | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);

  const [inventoryTracked, setInventoryTracked] = React.useState(true);
  const [inventoryOpen, setInventoryOpen] = React.useState(false);
  const [quantity, setQuantity] = React.useState("0");
  const [shopLocation, setShopLocation] = React.useState("2");
  const [continueSelling, setContinueSelling] = React.useState(false);
  const [barcodeType, setBarcodeType] = React.useState<
    "Custom" | "GTIN" | "UPC" | "EAN" | "ISBN" | "ASIN" | "NS-PID" | "add"
  >("Custom");

  const [shippingOpen, setShippingOpen] = React.useState(false);
  const [packedL, setPackedL] = React.useState("0.0");
  const [packedW, setPackedW] = React.useState("0.0");
  const [packedH, setPackedH] = React.useState("0.0");
  const [priceOpen, setPriceOpen] = React.useState(false);
  const [unitPriceOpen, setUnitPriceOpen] = React.useState(false);
  const [totalAmount, setTotalAmount] = React.useState("0");
  const [baseMeasure, setBaseMeasure] = React.useState("1");
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false);
  const [selectedMedia, setSelectedMedia] = React.useState<PickedMedia[]>([]);

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
      price: "",
      compare_at_price: "",
      unit_price: "",
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
      const {
        data: { user },
      } = await supabase.auth.getUser();

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
        weight_grams: values.weight_grams
          ? parseInt(values.weight_grams)
          : null,
        weight_unit: "g",
        hs_code: values.hs_code || null,
        country_of_origin: values.country_of_origin || null,
        price: values.price || null,
        compare_at_price: values.compare_at_price || null,
        unit_price: values.unit_price || null,
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
        if (selectedMedia.length > 0 && result.id) {
          for (const [index, media] of selectedMedia.entries()) {
            const imageResult = await createProductImage({
              product_id: result.id as string,
              variant_ids: [],
              src: media.url,
              alt: media.name,
              position: index + 1,
            });
            if (!imageResult.ok) {
              toast.error(imageResult.error);
              return;
            }
          }
        }
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

  useDirtyForm({
    dirty: form.formState.isDirty,
    saving: isSubmitting,
    label: "Unsaved product",
    onDiscard: () => {
      form.reset();
      setSelectedMedia([]);
      router.push("/products");
    },
    onSave: () => {
      void form.handleSubmit(onSubmit, () => {
        toast.error("Review the highlighted fields before saving.");
      })();
    },
  });

  // Early return check comes AFTER all Hook declarations
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
    <div className="relative min-h-screen bg-white text-[#202223]">
      <div className="relative mx-auto flex max-w-[1088px] flex-col px-0 py-2 overflow-hidden">
        <div className="mb-8">
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-[#202223]">
            Add product
          </h1>
        </div>
        <form
          id="product-form"
          onSubmit={form.handleSubmit(onSubmit, () => {
            toast.error("Review the highlighted fields before saving.");
          })}
          className="lg:grid lg:grid-cols-[minmax(0,760px)_280px] lg:gap-12"
        >
          {/* Left column - main form */}
          <div className="space-y-8">
            {/* Shopify groups the identity fields into one primary card. */}
            <Card className="overflow-hidden">
              <CardContent className="space-y-6 p-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Title</Label>
                  <Input
                    id="name"
                    {...form.register("name")}
                    placeholder="Short sleeve t-shirt"
                    className="bg-white text-lg"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <div className="relative">
                    <div className="flex h-10 items-center gap-1 overflow-x-auto rounded-t-md border border-b-0 border-[#d2d5d9] bg-[#f6f6f7] px-2">
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Formatting options"
                        title="Formatting options"
                      >
                        ☷
                      </button>
                      <button
                        type="button"
                        className="h-7 whitespace-nowrap rounded px-2 text-xs hover:bg-white"
                        aria-label="Paragraph"
                      >
                        Paragraph⌄
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs font-semibold hover:bg-white"
                        aria-label="Bold"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs italic hover:bg-white"
                        aria-label="Italic"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs underline hover:bg-white"
                        aria-label="Underline"
                      >
                        U
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Link"
                      >
                        🔗
                      </button>
                      <span className="mx-1 h-5 w-px bg-[#d2d5d9]" />
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Text color"
                      >
                        A⌄
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Alignment"
                      >
                        ☰⌄
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Insert image"
                      >
                        ▧
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Insert video"
                      >
                        ▷
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Insert table"
                      >
                        ▦⌄
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Bulleted list"
                      >
                        ☷
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Numbered list"
                      >
                        ☷
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Outdent"
                      >
                        ⇤
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Indent"
                      >
                        ⇥
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs hover:bg-white"
                        aria-label="Clear formatting"
                      >
                        ⊘
                      </button>
                      <button
                        type="button"
                        className="h-7 rounded px-2 text-xs font-mono hover:bg-white"
                        aria-label="Show HTML"
                      >
                        &lt;/&gt;
                      </button>
                    </div>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      rows={8}
                      placeholder="Describe your product..."
                      className="min-h-[154px] rounded-t-none border-[#d2d5d9] bg-white pt-3"
                    />
                  </div>
                  {form.formState.errors.description && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.description.message}
                    </p>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="flex min-h-[124px] flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[#8c9196] p-5 text-center">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setMediaPickerOpen(true)}
                      >
                        Upload new
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMediaPickerOpen(true)}
                      >
                        Select existing
                      </Button>
                    </div>
                    <p className="text-xs text-[#616161]">
                      Accepts images, videos, or 3D models
                    </p>
                    {selectedMedia.length > 0 && (
                      <span className="text-xs text-[#616161]">
                        {selectedMedia.length} media selected
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="hidden"
                      onClick={() => setMediaPickerOpen(true)}
                    >
                      Add media
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category_id">Category</Label>
                  <Select
                    className="w-full"
                    value={form.watch("category_id") || ""}
                    onValueChange={(v) =>
                      form.setValue("category_id", v || null)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue>Choose a product category</SelectValue>
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
            <div className="space-y-4">
              <CardHeader>
                <CardTitle>Price</CardTitle>
              </CardHeader>
              <Card>
                <CardContent className="space-y-4">
                  <InputGroup className="max-w-[230px] bg-white">
                    <InputGroupInput
                      placeholder="0.00"
                      {...form.register("price")}
                    />
                    <InputGroupAddon>
                      <IndianRupee />
                    </InputGroupAddon>
                  </InputGroup>
                </CardContent>

                <CardFooter className="flex items-center justify-between gap-2 p-4">
                  <Collapsible
                    open={priceOpen}
                    onOpenChange={setPriceOpen}
                    className="w-full"
                  >
                    <CollapsibleTrigger className="w-full flex items-center justify-between">
                      {priceOpen ? (
                        <>
                          <div
                            className="flex flex-row items-center justify-between w-full cursor-pointer group"
                            onClick={() => setPriceOpen(false)}
                          >
                            <p className="text-sm font-medium">
                              Additional display prices
                            </p>
                            <ChevronUp className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                          </div>
                        </>
                      ) : (
                        <div
                          className="flex items-center justify-between w-full cursor-pointer group"
                          onClick={() => setPriceOpen(true)}
                        >
                          <div className="flex gap-2">
                            <Badge
                              variant="outline"
                              className="text-xs h-7 rounded-lg shrink-0"
                            >
                              Compare-at
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs h-7 rounded-lg shrink-0"
                            >
                              Unit price
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs h-7 rounded-lg shrink-0"
                            >
                              Charge tax{" "}
                              {form.watch("is_tax_inclusive") ? "Yes" : "No"}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="text-xs h-7 rounded-lg shrink-0"
                            >
                              Cost per item
                            </Badge>
                          </div>
                          <ChevronDown className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                        </div>
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="space-y-2">
                        {priceOpen && (
                          <div className="mt-3 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="compare-at-price">
                                  Compare-at price
                                </Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    id="compare-at-price"
                                    type="text"
                                    placeholder="₹ 0.00"
                                    className="flex-1"
                                    {...form.register("compare_at_price")}
                                  />
                                  <button
                                    type="button"
                                    className="shrink-0 p-1.5 text-muted-foreground hover:bg-muted rounded-md"
                                  >
                                    <Info className="size-3" />
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="unit-price">Unit price</Label>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setUnitPriceOpen(true)}
                                    className="flex w-full items-center justify-between rounded-lg border border-input bg-background px-3 py-2 text-sm"
                                  >
                                    <span>
                                      {form.watch("unit_price") || "--"}
                                    </span>
                                    <ChevronDown className="size-4 text-muted-foreground shrink-0" />
                                  </button>
                                  {unitPriceOpen && (
                                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-input bg-background shadow-lg">
                                      <div className="p-4 space-y-4">
                                        <div className="space-y-2">
                                          <Label htmlFor="unit-price-input">
                                            Unit price
                                          </Label>
                                          <Input
                                            id="unit-price-input"
                                            {...form.register("unit_price")}
                                            className="text-sm"
                                            autoFocus
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="total-amount">
                                            Total amount
                                          </Label>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              id="total-amount"
                                              type="number"
                                              value={totalAmount}
                                              onChange={(e) =>
                                                setTotalAmount(e.target.value)
                                              }
                                              className="flex-1"
                                            />
                                            <Select defaultValue="g">
                                              <SelectTrigger className="w-[64px]">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="g">
                                                  g
                                                </SelectItem>
                                                <SelectItem value="kg">
                                                  kg
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div className="space-y-2">
                                          <Label htmlFor="base-measure">
                                            Base measure
                                          </Label>
                                          <div className="flex items-center gap-2">
                                            <Input
                                              id="base-measure"
                                              type="number"
                                              value={baseMeasure}
                                              onChange={(e) =>
                                                setBaseMeasure(e.target.value)
                                              }
                                              className="flex-1"
                                            />
                                            <Select defaultValue="kg">
                                              <SelectTrigger className="w-[64px]">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="kg">
                                                  kg
                                                </SelectItem>
                                                <SelectItem value="g">
                                                  g
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        </div>
                                        <div className="flex justify-end gap-2 pt-2">
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setUnitPriceOpen(false)
                                            }
                                          >
                                            Clear
                                          </Button>
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              setUnitPriceOpen(false)
                                            }
                                          >
                                            Cancel
                                          </Button>
                                          <Button
                                            size="sm"
                                            disabled
                                            onClick={() =>
                                              setUnitPriceOpen(false)
                                            }
                                          >
                                            Done
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <Checkbox
                                id="charge-tax"
                                checked={form.watch("is_tax_inclusive")}
                                onCheckedChange={(v) =>
                                  form.setValue("is_tax_inclusive", v)
                                }
                              />
                              <label
                                htmlFor="charge-tax"
                                className="text-sm text-muted-foreground cursor-select-none"
                              >
                                Charge tax on this product
                              </label>
                            </div>

                            <div className="flex gap-2 border-t pt-2">
                              <InputGroup className="w-30 space-x-2 gap-1">
                                <InputGroupInput
                                  placeholder="-"
                                  className="bg-muted-foreground! text-foreground! p-2! h-5 rounded-2xl"
                                />
                                <InputGroupAddon>
                                  <InputGroupText> Cost</InputGroupText>
                                </InputGroupAddon>
                              </InputGroup>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="flex-1"
                              >
                                Cost
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="flex-1"
                              >
                                Profit
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="flex-1"
                              >
                                Margin
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </CardFooter>
              </Card>
            </div>

            {/* Inventory */}
            <Card className="">
              <CardHeader className="flex flex-row justify-between gap-2 py-0">
                <CardTitle className="text-sm">Inventory</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>
                    {inventoryTracked ? "Inventory tracked" : "Not tracked"}
                  </span>
                  <Switch
                    checked={inventoryTracked}
                    onCheckedChange={setInventoryTracked}
                    size="sm"
                  />
                </div>
              </CardHeader>
              {inventoryTracked && (
                <CardContent className="border m-2 p-2 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-2 gap-4 text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="text-muted-foreground border-b-2 border-dotted ">
                        Quantity
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 px-4 text-sm">
                      <span className="text-muted-foreground">
                        Shop location
                      </span>
                      <div className="relative inline-flex items-center">
                        <Input
                          id="quantity"
                          type="number"
                          inputMode="numeric"
                          min={0}
                          step={1}
                          value={quantity}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === "" || /^\d+$/.test(val)) {
                              setQuantity(val);
                            }
                          }}
                          onBlur={() => {
                            if (quantity === "") setQuantity("0");
                          }}
                          className="w-[72px] text-right text-sm pr-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <div className="absolute right-1 inset-y-1 flex flex-col justify-center">
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            className="flex items-center justify-center h-4 w-5 rounded-sm text-[9px] leading-none text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            onClick={() =>
                              setQuantity(
                                String(Math.max(0, Number(quantity || 0) + 1)),
                              )
                            }
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            disabled={Number(quantity || 0) <= 0}
                            className="flex items-center justify-center h-4 w-5 rounded-sm text-[9px] leading-none text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 disabled:pointer-events-none transition-colors"
                            onClick={() =>
                              setQuantity(
                                String(Math.max(0, Number(quantity || 0) - 1)),
                              )
                            }
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              )}
              <CardFooter className="flex items-center justify-between gap-2 p-4">
                <Collapsible
                  open={inventoryOpen}
                  onOpenChange={setInventoryOpen}
                  className="w-full"
                >
                  <CollapsibleTrigger className="w-full flex items-center justify-between">
                    {inventoryOpen ? (
                      <>
                        <div
                          className="flex flex-row items-center justify-between w-full cursor-pointer group"
                          onClick={() => setInventoryOpen(false)}
                        >
                          <p className="text-sm font-medium">More details</p>
                          <ChevronUp className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                        </div>
                      </>
                    ) : (
                      <div
                        className="flex items-center justify-between w-full cursor-pointer group"
                        onClick={() => setInventoryOpen(true)}
                      >
                        <div className="flex gap-2">
                          <Badge
                            variant="outline"
                            className="text-xs h-7 rounded-lg shrink-0"
                          >
                            SKU
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs h-7 rounded-lg shrink-0"
                          >
                            Barcodes
                          </Badge>
                          <Badge
                            variant="outline"
                            className="text-xs h-7 rounded-lg shrink-0"
                          >
                            Sell when out of stock{" "}
                            {continueSelling ? "On" : "Off"}
                          </Badge>
                        </div>
                        <ChevronDown className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                      </div>
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-2">
                      {inventoryOpen && (
                        <div className="mt-3 space-y-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1">
                              <Label
                                htmlFor="inventory-sku"
                                className="text-sm text-muted-foreground"
                              >
                                SKU (Stock Keeping Unit)
                              </Label>
                              <Input id="inventory-sku" placeholder="SKU" />
                            </div>
                            <div className="space-y-1">
                              <Label
                                htmlFor="inventory-barcodes"
                                className="text-sm text-muted-foreground"
                              >
                                Barcodes
                              </Label>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className={"w-full cursor-pointer"}
                                >
                                  <InputGroup>
                                    <InputGroupAddon>
                                      <Barcode />
                                    </InputGroupAddon>
                                    <InputGroupInput
                                      placeholder="ISBN, UPC, GTIN, etc."
                                      disabled
                                      className="cursor-pointer!"
                                    />
                                    <InputGroupAddon align={"inline-end"}>
                                      {" "}
                                      <ChevronsUpDown size={16} />
                                    </InputGroupAddon>
                                  </InputGroup>
                                </DropdownMenuTrigger>

                                <DropdownMenuContent
                                  align="center"
                                  className="w-full"
                                >
                                  <div className="max-w-xs w-full">
                                    <InputGroup>
                                      <InputGroupAddon>
                                        <Barcode />
                                      </InputGroupAddon>
                                      <InputGroupInput placeholder="Barcode" />
                                      <InputGroupAddon align={"inline-end"}>
                                        <Select
                                          id="inventory-barcodes"
                                          value={
                                            barcodeType === "add"
                                              ? ""
                                              : barcodeType
                                          }
                                          onValueChange={(v) => {
                                            if (v === "add") {
                                              return;
                                            }
                                            setBarcodeType(
                                              v as typeof barcodeType,
                                            );
                                          }}
                                        >
                                          <SelectTrigger
                                            className={
                                              "bg-transparent! border-none!"
                                            }
                                          >
                                            <SelectValue
                                              placeholder={
                                                barcodeType === "add"
                                                  ? "ISBN, UPC, GTIN, etc."
                                                  : barcodeType
                                              }
                                            />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="Custom">
                                              Custom
                                            </SelectItem>
                                            <SelectItem value="GTIN">
                                              GTIN
                                            </SelectItem>
                                            <SelectItem value="UPC">
                                              UPC
                                            </SelectItem>
                                            <SelectItem value="EAN">
                                              EAN
                                            </SelectItem>
                                            <SelectItem value="ISBN">
                                              ISBN
                                            </SelectItem>
                                            <SelectItem value="ASIN">
                                              ASIN
                                            </SelectItem>
                                            <SelectItem value="NS-PID">
                                              NS-PID
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </InputGroupAddon>
                                    </InputGroup>

                                    <DropdownMenuGroup className="mt-2 flex justify-between">
                                      <Button size="sm" variant="ghost">
                                        <CirclePlus className="size-3" />
                                        Add barcode
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant={"destructive"}
                                        className="bg-transparent! text-destructive hover:bg-destructive/10"
                                      >
                                        Clear all
                                      </Button>
                                    </DropdownMenuGroup>
                                  </div>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          {inventoryTracked && (
                            <div className="flex items-center gap-3 pt-2">
                              <Checkbox
                                id="continue-selling"
                                checked={continueSelling}
                                onCheckedChange={setContinueSelling}
                              />
                              <label
                                htmlFor="continue-selling"
                                className="text-sm text-muted-foreground cursor-select-none"
                              >
                                Continue selling when out of stock
                              </label>
                              {continueSelling && (
                                <Tooltip>
                                  <TooltipTrigger>
                                    {" "}
                                    <Badge
                                      variant="outline"
                                      className="text-xs h-6 rounded-md px-2 py-1 shrink-0"
                                    >
                                      <Info className="size-3 text-muted-foreground shrink-0" />
                                      POS excluded
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="bottom"
                                    className="max-w-[250px]"
                                  >
                                    <p>
                                      Staff can complete sales on POS even if
                                      items are out of stock
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </CardFooter>
            </Card>

            {/* Shipping */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Shipping</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>
                      {form.watch("requires_shipping")
                        ? "Physical product"
                        : "Not a physical product"}
                    </span>
                    <Switch
                      checked={form.watch("requires_shipping")}
                      onCheckedChange={(v) =>
                        form.setValue("requires_shipping", v)
                      }
                      size="sm"
                    />
                  </div>
                </div>
              </CardHeader>
              {form.watch("requires_shipping") && (
                <>
                  <CardContent className="space-y-4">
                    <>
                      <div className="space-y-2 grid grid-cols-2">
                        <Label htmlFor="package-when-shipped">
                          Package when shipped alone
                        </Label>
                        <div className="max-w-md w-full overflow-hidden">
                          <Select defaultValue="Store default - Sample box - 22 × 13.7 × 4.2 cm, 0 kg">
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Store default" />
                            </SelectTrigger>
                            <SelectContent className={""}>
                              <SelectItem value="Store default - Sample box - 22 × 13.7 × 4.2 cm, 0 kg">
                                Store default - Sample box - 22 × 13.7 × 4.2 cm,
                                0 kg
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2 grid grid-cols-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Label htmlFor="packed-size">
                            Packed product size
                          </Label>
                          <Info className="size-2.5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center max-w-md gap-2">
                          <Input
                            id="packed-l"
                            type="number"
                            step="0.1"
                            placeholder="L 0.0"
                            className="flex-1 text-sm"
                            value={packedL}
                            onChange={(e) => setPackedL(e.target.value)}
                          />
                          <span className="text-muted-foreground text-sm">
                            ×
                          </span>
                          <Input
                            id="packed-w"
                            type="number"
                            step="0.1"
                            placeholder="W 0.0"
                            className="flex-1 text-sm"
                            value={packedW}
                            onChange={(e) => setPackedW(e.target.value)}
                          />
                          <span className="text-muted-foreground text-sm">
                            ×
                          </span>
                          <Input
                            id="packed-h"
                            type="number"
                            step="0.1"
                            placeholder="H 0.0"
                            className="flex-1 text-sm"
                            value={packedH}
                            onChange={(e) => setPackedH(e.target.value)}
                          />
                          <Select defaultValue="cm">
                            <SelectTrigger className="w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cm">cm</SelectItem>
                              <SelectItem value="in">in</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-2 grid grid-cols-2">
                        <div className="flex items-center gap-1 text-sm">
                          <Label htmlFor="weight">Weight</Label>
                          <Info className="size-2.5 text-muted-foreground" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="weight"
                            type="number"
                            min="0"
                            step="0.1"
                            placeholder="0.0"
                            className="flex-1 text-sm"
                            {...form.register("weight_grams")}
                          />
                          <Select defaultValue="kg">
                            <SelectTrigger className="w-[80px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="kg">kg</SelectItem>
                              <SelectItem value="g">g</SelectItem>
                              <SelectItem value="oz">oz</SelectItem>
                              <SelectItem value="lb">lb</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </>
                  </CardContent>

                  <CardFooter className="flex items-center justify-between gap-2 p-4">
                    <Collapsible
                      open={shippingOpen}
                      onOpenChange={setShippingOpen}
                      className="w-full"
                    >
                      <CollapsibleTrigger className="w-full flex items-center justify-between">
                        {shippingOpen ? (
                          <>
                            <div
                              className="flex flex-row items-center justify-between w-full cursor-pointer group"
                              onClick={() => setShippingOpen(false)}
                            >
                              <p className="text-sm font-medium">
                                More details
                              </p>
                              <ChevronUp className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                            </div>
                          </>
                        ) : (
                          <div
                            className="flex items-center justify-between w-full cursor-pointer group"
                            onClick={() => setShippingOpen(true)}
                          >
                            <div className="flex gap-2">
                              <Badge
                                variant="outline"
                                className="text-xs px-2.5 py-1"
                              >
                                Country of origin
                              </Badge>
                              <Badge
                                variant="outline"
                                className="text-xs px-2.5 py-1"
                              >
                                HS Code
                              </Badge>
                            </div>
                            <ChevronDown className="size-4 text-muted-foreground group-hover:text-body shrink-0" />
                          </div>
                        )}
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-2">
                          {shippingOpen && (
                            <div className="mt-3 space-y-4">
                              <div className="space-y-2 flex flex-col">
                                <Label htmlFor="shipping-country">
                                  Country/Region of origin
                                </Label>

                                <NativeSelect className="w-full">
                                  <NativeSelectOption value="">
                                    China
                                  </NativeSelectOption>
                                  <NativeSelectOption value="apple">
                                    UAE
                                  </NativeSelectOption>
                                  <NativeSelectOption value="banana">
                                    Singapore
                                  </NativeSelectOption>
                                  <NativeSelectOption value="blueberry">
                                    USA
                                  </NativeSelectOption>
                                  <NativeSelectOption value="pineapple">
                                    India
                                  </NativeSelectOption>
                                </NativeSelect>
                              </div>
                              <div className="space-y-2 flex flex-col">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-2 flex">
                                    <Label htmlFor="shipping-hs">
                                      Harmonized System (HS) code
                                    </Label>
                                    <Info className="size-2.5 text-muted-foreground" />
                                  </div>
                                  <button
                                    type="button"
                                    className="shrink-0 p-1 text-muted-foreground hover:bg-muted rounded-md"
                                  >
                                    …
                                  </button>
                                </div>
                                <Input
                                  id="shipping-hs"
                                  placeholder="Enter a 6-digit code or search by keyword"
                                  className="text-sm"
                                  {...form.register("hs_code")}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </CardFooter>
                </>
              )}
            </Card>

            {/* Variants */}
            <div className="space-y-4">
              <CardHeader>
                <CardTitle>Variants</CardTitle>
              </CardHeader>
              <Card>
                <CardContent>
                  <div className="">
                    <Button
                      variant={"ghost"}
                      className="flex items-center gap-2 cursor-pointer select-none group"
                    >
                      <Plus className="size-4" />

                      <span className="text-xs text-body">
                        Add options like size or color
                      </span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Product metafields */}
            <div className="space-y-4">
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Product metafields</CardTitle>
                <Button variant="outline" size="sm">
                  Add definition
                </Button>
              </CardHeader>
              <Card>
                <CardContent className="flex items-center justify-between">
                  <span className="text-sm text-body">
                    No metafields pinned
                  </span>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" size="sm">
                    <Plus />
                    Disclosures
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Search engine listing */}
            <Collapsible
              open={seoOpen}
              onOpenChange={setSeoOpen}
              className="group/collapsible space-y-4"
            >
              <CardHeader className="flex items-center justify-between">
                <CardTitle>Search engine listing</CardTitle>
                <CollapsibleTrigger
                  render={
                    <button
                      type="button"
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Edit className="ml-auto size-4 text-muted-foreground group-hover:text-brand transition-colors shrink-0" />
                    </button>
                  }
                />
              </CardHeader>
              <Card>
                <CardContent className="space-y-4">
                  {!seoOpen && (
                    <p className="text-xs font-medium text-muted-foreground line-clamp-2">
                      Add a title and description to see how this product might
                      appear in a search engine listing
                    </p>
                  )}

                  <CollapsibleContent className="space-y-4 pt-2">
                    {/* Page title */}
                    <div className="space-y-2">
                      <Label htmlFor="seo_title">Page title</Label>
                      <Input
                        id="seo_title"
                        {...form.register("seo_title")}
                        maxLength={70}
                        placeholder="Short sleeve t-shirt"
                      />
                      <div className="flex justify-end text-xs text-muted-foreground">
                        {(form.watch("seo_title") ?? "").length}/70
                      </div>
                    </div>

                    {/* Meta description */}
                    <div className="space-y-2">
                      <Label htmlFor="seo_description">Meta description</Label>
                      <Textarea
                        id="seo_description"
                        {...form.register("seo_description")}
                        maxLength={320}
                        rows={3}
                        placeholder="Add a meta description for search results"
                      />
                      <div className="flex justify-end text-xs text-muted-foreground">
                        {(form.watch("seo_description") ?? "").length}/320
                      </div>
                    </div>

                    {/* URL handle */}
                    <div className="space-y-2">
                      <Label htmlFor="handle">URL handle</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">products/</span>
                        <Input
                          id="handle"
                          {...form.register("handle")}
                          maxLength={255}
                          placeholder="short-sleeve-t-shirt"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        https://maara.co.in/products/{" "}
                        {watchHandle || slugify(watchName) || ""}
                      </p>
                    </div>
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          </div>

          {/* Right column - side panel */}
          <div className="space-y-5 lg:sticky lg:top-6">
            {/* Status */}
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="border-b px-0 pb-3 pt-0">
                <CardTitle className="text-sm font-semibold">Status</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pt-3">
                <Select
                  className="w-full"
                  value={form.watch("status")}
                  onValueChange={(v) =>
                    form.setValue("status", v as "draft" | "active")
                  }
                >
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue>
                      {form.watch("status") === "active" ? "Active" : "Draft"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Publishing */}
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="border-b px-0 pb-3 pt-0">
                <CardTitle className="text-sm font-semibold">
                  Publishing
                </CardTitle>
              </CardHeader>
              <CardContent className="px-0 pt-3">
                <Select className="w-full" defaultValue="all">
                  <SelectTrigger className="w-full bg-white">
                    <SelectValue>All channels</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All channels</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Product organization */}
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader className="border-b px-0 pb-3 pt-0">
                <CardTitle className="text-sm font-semibold">
                  Product organization
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-0 pt-3">
                <div className="space-y-2">
                  <Label htmlFor="product_type">Type</Label>
                  <Select
                    className="w-full"
                    value={form.watch("product_type") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("product_type", v ?? undefined)
                    }
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue>None</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendor">Vendor</Label>
                  <Select
                    className="w-full"
                    value={form.watch("vendor") ?? ""}
                    onValueChange={(v) =>
                      form.setValue("vendor", v ?? undefined)
                    }
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue>None</SelectValue>
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
                  <Select className="w-full" defaultValue="default">
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue>Default product</SelectValue>
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

        <MediaPicker
          open={mediaPickerOpen}
          onOpenChange={setMediaPickerOpen}
          multiple
          maxSelection={10}
          acceptedTypes={["image", "video", "other"]}
          selectedMedia={selectedMedia}
          onConfirm={(media) => {
            setSelectedMedia(media);
            // Keep the dirty bar in sync with media-only edits.
            form.setValue("description", form.getValues("description"), {
              shouldDirty: true,
            });
          }}
          folder="products"
        />
      </div>
    </div>
  );
}
