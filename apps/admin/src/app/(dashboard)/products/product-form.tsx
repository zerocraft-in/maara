"use client";

import * as React from "react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Save,
  X,
  Plus,
  Trash2,
  GripVertical,
  Image as ImageIcon,
  Search,
  Globe,
  Truck,
  Tag,
  Settings,
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import {
  createProduct,
  updateProduct,
  createProductOption,
  deleteProductOption,
  createProductImage,
  deleteProductImage,
  updateProductImage,
} from "./actions";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/components/media-picker/media-picker";
import { useDirtyForm } from "@/components/providers/dirty-provider";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  formatPaise,
  paise,
  rupeesToPaise,
  paiseToInputValue,
} from "@/lib/money";
import { toast } from "sonner";
import { cn, slugify } from "@/lib/utils";
import type { CategoryOption } from "./types";

type ProductFormMode = "create" | "edit";

interface ProductFormProps {
  mode: ProductFormMode;
  organizationId: string;
  categories: CategoryOption[];
  product?: {
    id: string;
    name: string;
    description: string | null;
    category_id: string | null;
    handle: string;
    vendor: string | null;
    product_type: string | null;
    tags: string[];
    tax_rate_bps: number;
    is_tax_inclusive: boolean;
    requires_shipping: boolean;
    weight_grams: number | null;
    weight_unit: "g" | "kg" | "oz" | "lb";
    hs_code: string | null;
    country_of_origin: string | null;
    seo_title: string | null;
    seo_description: string | null;
    published_scope: "web" | "global";
    status: string;
    product_options: Array<{
      id: string;
      name: string;
      position: 1 | 2 | 3;
      values: string[];
    }>;
  };
  images?: Array<{
    id: string;
    product_id?: string;
    variant_ids: string[];
    src: string;
    alt: string | null;
    position: number;
    width: number | null;
    height: number | null;
  }>;
  onSuccess: () => void;
  onClose: () => void;
}

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
    .refine((v) => Number(v) <= 100),
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

const optionSchema = z.object({
  name: z.string().trim().min(1).max(50),
  values: z.array(z.string().trim().min(1).max(50)).min(1),
});

function bpsToPercentInput(bps: number): string {
  const percent = bps / 100;
  return Number.isInteger(percent) ? String(percent) : percent.toFixed(2);
}

export default function ProductForm({
  mode,
  organizationId,
  categories,
  product,
  images: imagesProp,
  onSuccess,
  onClose,
}: ProductFormProps) {
  const isEdit = mode === "edit";
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("details");
  const [tagInput, setTagInput] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerMulti, setPickerMulti] = React.useState(false);

  type WorkingImage = {
    id: string;
    src: string;
    alt: string | null;
    position: number;
    featured: boolean;
    isNew: boolean;
  };

  // Working set of product images. New (unsaved) images use a negative temp id.
  const [images, setImages] = React.useState<WorkingImage[]>([]);

  const originalImages = React.useMemo(() => {
    return (imagesProp ?? []).map((img) => ({
      id: img.id,
      src: img.src,
      alt: img.alt ?? null,
      position: img.position,
      featured: img.position === 1,
      isNew: false,
    }));
  }, [imagesProp]);

  // Seed working set from existing images on mount.
  React.useEffect(() => {
    setImages(
      originalImages.map((img, i) => ({
        ...img,
        id: img.id || `new-${i}`,
        featured: img.featured || i === 0,
      })),
    );
  }, [originalImages]);

  const defaultOptions =
    product?.product_options.map((opt) => ({
      name: opt.name,
      values: opt.values,
    })) ?? [];

  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: product?.name ?? "",
      description: product?.description ?? "",
      handle: product?.handle ?? "",
      vendor: product?.vendor ?? "",
      product_type: product?.product_type ?? "",
      tags: product?.tags ?? [],
      category_id: product?.category_id ?? null,
      tax_rate_percent: bpsToPercentInput(product?.tax_rate_bps ?? 0),
      is_tax_inclusive: product?.is_tax_inclusive ?? false,
      requires_shipping: product?.requires_shipping ?? true,
      weight_grams: product?.weight_grams ? String(product.weight_grams) : "",
      weight_unit: product?.weight_unit ?? "g",
      hs_code: product?.hs_code ?? "",
      country_of_origin: product?.country_of_origin ?? "",
      seo_title: product?.seo_title ?? "",
      seo_description: product?.seo_description ?? "",
      published_scope: product?.published_scope ?? "web",
      status: product?.status === "active" ? "active" : "draft",
      options:
        product?.product_options.map((opt) => ({
          name: opt.name,
          values: opt.values,
        })) ?? [],
    },
  });

  const {
    fields: optionsFields,
    append: appendOption,
    remove: removeOption,
    move: moveOption,
  } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag) {
        const currentTags = form.getValues("tags") ?? [];
        if (!currentTags.includes(tag)) {
          form.setValue("tags", [...currentTags, tag], {
            shouldValidate: true,
          });
        }
        setTagInput("");
      }
    } else if (
      e.key === "Backspace" &&
      !tagInput &&
      (form.getValues("tags") ?? []).length > 0
    ) {
      const currentTags = [...(form.getValues("tags") ?? [])];
      currentTags.pop();
      form.setValue("tags", currentTags, { shouldValidate: true });
    }
  };

  const handleTagRemove = (tag: string) => {
    form.setValue(
      "tags",
      (form.getValues("tags") ?? []).filter((t) => t !== tag),
      { shouldValidate: true },
    );
  };

  // ---- Image management ----

  const nextTempId = React.useMemo(() => {
    let n = 0;
    return () => `new-${--n}`;
  }, []);

  const handleOpenPicker = () => {
    setPickerMulti(true);
    setPickerOpen(true);
  };

  const handlePickerConfirm = (picked: Array<{
    id: string;
    key: string;
    name: string;
    url: string;
    contentType: string | null;
    size: number;
    organizationId: string;
  }>) => {
    setImages((prev) => {
      const next = [...prev];
      for (const p of picked) {
        // Avoid duplicates by src.
        if (next.some((img) => img.src === p.url)) continue;
        next.push({
          id: nextTempId(),
          src: p.url,
          alt: p.name,
          position: next.length + 1,
          featured: next.length === 0,
          isNew: true,
        });
      }
      // Re-index positions and ensure only one featured.
      return reindexImages(next);
    });
    setPickerOpen(false);
  };

  const reindexImages = (list: WorkingImage[]) => {
    let featuredSet = false;
    return list.map((img, i) => {
      const isFeatured = img.featured && !featuredSet;
      if (isFeatured) featuredSet = true;
      return { ...img, position: i + 1, featured: isFeatured };
    });
  };

  const handleImageRemove = (id: string) => {
    setImages((prev) => {
      const next = prev.filter((img) => img.id !== id);
      return reindexImages(next);
    });
  };

  const handleImageMove = (id: string, direction: -1 | 1) => {
    setImages((prev) => {
      const idx = prev.findIndex((img) => img.id === id);
      if (idx === -1) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return reindexImages(next);
    });
  };

  const handleFeaturedToggle = (id: string) => {
    setImages((prev) =>
      prev.map((img) => ({
        ...img,
        featured: img.id === id,
      })),
    );
  };

  const handleImageAltChange = (id: string, alt: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, alt: alt || null } : img,
      ),
    );
  };

  const addOptionValue = (optionIndex: number) => {
    const currentOptions = form.getValues("options") ?? [];
    const newOptions = [...currentOptions];
    newOptions[optionIndex] = {
      ...newOptions[optionIndex],
      values: [...(newOptions[optionIndex].values ?? []), ""],
    };
    form.setValue("options", newOptions);
  };

  const removeOptionValue = (optionIndex: number, valueIndex: number) => {
    const currentOptions = form.getValues("options") ?? [];
    const newOptions = [...currentOptions];
    newOptions[optionIndex] = {
      ...newOptions[optionIndex],
      values: (newOptions[optionIndex].values ?? []).filter(
        (_: string, i: number) => i !== valueIndex,
      ),
    };
    form.setValue("options", newOptions);
  };

  const updateOptionValue = (
    optionIndex: number,
    valueIndex: number,
    value: string,
  ) => {
    const currentOptions = form.getValues("options") ?? [];
    const newOptions = [...currentOptions];
    newOptions[optionIndex] = {
      ...newOptions[optionIndex],
      values: (newOptions[optionIndex].values ?? []).map(
        (v: string, i: number) => (i === valueIndex ? value : v),
      ),
    };
    form.setValue("options", newOptions);
  };

  const generateHandle = (name: string) => {
    return slugify(name);
  };

  const watchName = form.watch("name");
  const watchHandle = form.watch("handle");

  React.useEffect(() => {
    if (!watchHandle && watchName) {
      form.setValue("handle", generateHandle(watchName), {
        shouldDirty: false,
      });
    }
  }, [watchName, watchHandle, form]);

  const onSubmit = async (values: z.infer<typeof productSchema>) => {
    setSubmitError(null);
    setIsSubmitting(true);

    const taxRateBps = Math.round(Number(values.tax_rate_percent) * 100);
    const weightGrams = values.weight_grams
      ? parseInt(values.weight_grams)
      : null;

    const payload = {
      name: values.name,
      description: values.description,
      handle: values.handle || generateHandle(values.name),
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
      options: values.options.filter((o) => o.name && o.values.some((v) => v)),
    };

    try {
      const result = isEdit
        ? await updateProduct({ ...payload, id: product!.id })
        : await createProduct(payload);

      if (!result.ok) {
        setSubmitError(result.error);
        setIsSubmitting(false);
        return;
      }

      const productId = isEdit
        ? product!.id
        : (result.id as string);

      // Persist image changes. Do not report success if image associations fail.
      const originalIds = new Set(originalImages.map((img) => img.id));
      const removed = originalImages.filter(
        (img) => !images.some((c) => c.id === img.id),
      );
      const toCreate = images.filter((img) => img.isNew);
      const toUpdate = images.filter(
        (img) =>
          !img.isNew &&
          originalImages.some(
            (o) =>
              o.id === img.id &&
              (o.position !== img.position || o.alt !== img.alt),
          ),
      );

      let imageError: string | null = null;

      for (const img of removed) {
        const r = await deleteProductImage({ id: img.id });
        if (!r.ok) imageError = r.error;
      }

      for (const img of toCreate) {
        const r = await createProductImage({
          product_id: productId,
          variant_ids: [],
          src: img.src,
          alt: img.alt,
          position: img.position,
        });
        if (!r.ok) imageError = r.error;
      }

      for (const img of toUpdate) {
        const r = await updateProductImage({
          id: img.id,
          position: img.position,
          alt: img.alt,
        });
        if (!r.ok) imageError = r.error;
      }

      if (imageError) {
        setSubmitError(imageError);
        setIsSubmitting(false);
        return;
      }

      onSuccess();
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const imagesDirty = React.useMemo(
    () => JSON.stringify(images) !== JSON.stringify(originalImages),
    [images, originalImages],
  );

  useDirtyForm({
    dirty: form.formState.isDirty || imagesDirty,
    saving: isSubmitting,
    label: isEdit ? "Unsaved changes" : "Unsaved product",
    onDiscard: () => {
      form.reset();
      setImages(originalImages);
      onClose();
    },
    onSave: () => {
      void form.handleSubmit(onSubmit, () => {
        toast.error("Review the highlighted fields before saving.");
      })();
    },
  });

  return (
    <Card className="fixed inset-0 z-50 mx-auto max-w-4xl flex h-[calc(100vh-2rem)] flex-col overflow-hidden">
      <CardHeader className="flex-shrink-0 border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">
              {isEdit ? "Edit product" : "Add product"}
            </CardTitle>
            <CardDescription>
              {isEdit
                ? "Update product details, variants, and settings."
                : "Create a new product with variants, images, and inventory."}
            </CardDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="size-5" />
          </Button>
        </div>
      </CardHeader>

      {submitError && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-6 py-3">
          <p className="text-sm text-destructive">{submitError}</p>
        </div>
      )}

      <CardContent className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Sidebar - Tabs Navigation */}
          <div className="hidden lg:flex lg:w-48 lg:flex-col lg:border-r lg:border-r-muted lg:bg-muted/30">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              orientation="vertical"
              className="flex h-full flex-col"
            >
              <TabsList className="flex h-full flex-col bg-transparent">
                <TabsTrigger
                  value="details"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <Tag className="size-4" />
                  Details
                </TabsTrigger>
                <TabsTrigger
                  value="variants"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <Settings className="size-4" />
                  Variants
                </TabsTrigger>
                <TabsTrigger
                  value="images"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <ImageIcon className="size-4" />
                  Images
                </TabsTrigger>
                <TabsTrigger
                  value="inventory"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <Truck className="size-4" />
                  Inventory
                </TabsTrigger>
                <TabsTrigger
                  value="shipping"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <Truck className="size-4" />
                  Shipping
                </TabsTrigger>
                <TabsTrigger
                  value="seo"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <Globe className="size-4" />
                  Search engine listing
                </TabsTrigger>
                <TabsTrigger
                  value="organization"
                  className="data-active:bg-background data-active:shadow-sm justify-start gap-3 px-3 py-2.5"
                >
                  <Tag className="size-4" />
                  Organization
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Main Content */}
          <form
            id="product-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 overflow-y-auto p-6 lg:pl-8"
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full"
            >
              {/* Details Tab */}
              <TabsContent value="details" className="h-full space-y-6">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...form.register("name")}
                      placeholder="e.g., Classic Oxford Shirt"
                      className="text-lg"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      rows={6}
                      placeholder="Describe your product..."
                      className="min-h-[120px]"
                    />
                    {form.formState.errors.description && (
                      <p className="text-sm text-destructive">
                        {form.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="vendor">Vendor</Label>
                      <Input
                        id="vendor"
                        {...form.register("vendor")}
                        placeholder="Brand or vendor name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="product_type">Product type</Label>
                      <Input
                        id="product_type"
                        {...form.register("product_type")}
                        placeholder="e.g., Shirt, Shoes"
                        list="product-types"
                      />
                      <datalist id="product-types">
                        {categories.map((c) => (
                          <option key={c.id} value={c.name} />
                        ))}
                      </datalist>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tax_rate_percent">
                        Tax rate (%) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="tax_rate_percent"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        {...form.register("tax_rate_percent")}
                        placeholder="0"
                      />
                      {form.formState.errors.tax_rate_percent && (
                        <p className="text-sm text-destructive">
                          {form.formState.errors.tax_rate_percent.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="status">Product status</Label>
                      <Select
                        value={form.watch("status")}
                        onValueChange={(v) =>
                          form.setValue("status", v as "draft" | "active")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Draft products are hidden from sales channels.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {(form.getValues("tags") ?? []).map((tag, index) => (
                        <Badge key={tag} variant="outline" className="gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleTagRemove(tag)}
                            className="ml-1 p-0 hover:bg-muted"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))}
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add tag (press Enter)"
                        className="w-auto min-w-[150px]"
                        aria-label="Add tag"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Press Enter or comma to add tags. Used for filtering and
                      organization.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Variants Tab */}
              <TabsContent value="variants" className="h-full space-y-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-4">Product Options</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Define up to 3 options (e.g., Size, Color, Material). Each
                      combination creates a variant. Maximum 100 variants per
                      product.
                    </p>

                    {optionsFields.length === 0 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => appendOption({ name: "", values: [""] })}
                        className="w-fit"
                      >
                        <Plus className="size-4 mr-2" />
                        Add option
                      </Button>
                    ) : (
                      <div className="space-y-4">
                        {optionsFields.map((option, index) => (
                          <Card key={option.id} className="p-4">
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <GripVertical className="text-muted-foreground cursor-grab size-5" />
                                  <Input
                                    {...form.register(`options.${index}.name`)}
                                    placeholder={`Option ${index + 1} name (e.g., Size)`}
                                    className="w-auto min-w-[150px]"
                                  />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Values will create variant combinations
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeOption(index)}
                                disabled={optionsFields.length <= 1}
                              >
                                <Trash2 className="size-4 text-destructive" />
                              </Button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {(
                                form.getValues(`options.${index}.values`) ?? []
                              ).map((value, valueIndex) => (
                                <div
                                  key={valueIndex}
                                  className="flex items-center gap-1"
                                >
                                  <Input
                                    value={value}
                                    onChange={(e) =>
                                      updateOptionValue(
                                        index,
                                        valueIndex,
                                        e.target.value,
                                      )
                                    }
                                    placeholder={`Value ${valueIndex + 1}`}
                                    className="w-auto min-w-[120px]"
                                  />
                                  {(
                                    form.getValues(`options.${index}.values`) ??
                                    []
                                  ).length > 1 && (
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        removeOptionValue(index, valueIndex)
                                      }
                                    >
                                      <X className="size-3.5" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => addOptionValue(index)}
                                className="h-9"
                              >
                                <Plus className="size-3.5 mr-1.5" />
                                Add value
                              </Button>
                            </div>
                          </Card>
                        ))}

                        {optionsFields.length < 3 && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                              appendOption({ name: "", values: [""] })
                            }
                            className="w-fit"
                          >
                            <Plus className="size-4 mr-2" />
                            Add another option
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Images Tab */}
              <TabsContent value="images" className="h-full space-y-6">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">Media</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleOpenPicker}
                      disabled={isSubmitting}
                    >
                      <Plus className="size-4 mr-2" />
                      Add images
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Select images from the media library or upload new ones.
                    Drag to reorder. The first image is the featured image.
                  </p>

                  {images.length === 0 ? (
                    <div className="flex items-center justify-center border-2 border-dashed border-border rounded-lg p-12 text-center text-muted-foreground">
                      <ImageIcon className="size-12 mb-2" />
                      <p>No images added yet</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                      {images.map((img) => {
                        const isFeatured = img.featured;
                        return (
                          <div
                            key={img.id}
                            className="relative flex flex-col gap-2"
                          >
                            <div className="aspect-video overflow-hidden rounded-lg border bg-muted">
                              <img
                                src={img.src}
                                alt={img.alt ?? ""}
                                className="h-full w-full object-cover"
                                loading="lazy"
                                decoding="async"
                              />
                              {isFeatured && (
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                                  Featured
                                </div>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium truncate w-20" title={img.alt ?? img.src}>
                                  {img.alt ?? img.src.split("/").pop() ?? "Image"}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Position {img.position}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleImageMove(img.id, -1)}
                                  disabled={img.position === 1}
                                  className="h-8 w-8 p-0"
                                  aria-label="Move image up"
                                >
                                  <span className="size-4">▲</span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() =>
                                    handleImageMove(img.id, 1)
                                  }
                                  disabled={
                                    img.position === images.length
                                  }
                                  className="h-8 w-8 p-0"
                                  aria-label="Move image down"
                                >
                                  <span className="size-4">▼</span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="outline"
                                  onClick={() => handleFeaturedToggle(img.id)}
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    isFeatured
                                      ? "bg-primary text-primary-foreground"
                                      : "",
                                  )}
                                  aria-label={isFeatured ? "Unset featured" : "Set featured"}
                                >
                                  <span className="size-4">★</span>
                                </Button>
                                <Button
                                  size="icon"
                                  variant="destructive"
                                  onClick={() => handleImageRemove(img.id)}
                                  className="h-8 w-8 p-0"
                                  aria-label="Remove image"
                                >
                                  <X className="size-4" />
                                </Button>
                              </div>
                            </div>
                            {img.alt !== null && (
                              <Input
                                value={img.alt ?? ""}
                                onChange={(e) =>
                                  handleImageAltChange(img.id, e.target.value)
                                }
                                placeholder="Alt text"
                                className="text-xs w-full"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <MediaPicker
                  open={pickerOpen}
                  onOpenChange={setPickerOpen}
                  multiple
                  maxSelection={10}
                  acceptedTypes={["image"]}
                  folder="products"
                  onConfirm={handlePickerConfirm}
                  onCancel={() => setPickerOpen(false)}
                />
              </TabsContent>

              {/* Inventory Tab */}
              <TabsContent value="inventory" className="h-full space-y-6">
                <div className="space-y-6">
                  <h3 className="font-medium">Inventory Policy</h3>
                  <p className="text-sm text-muted-foreground">
                    Inventory is managed per variant in the Variants tab. This
                    section shows an overview.
                  </p>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Tracked variants
                          </p>
                          <p className="text-2xl font-bold">—</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Total quantity
                          </p>
                          <p className="text-2xl font-bold">—</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">
                            Low stock
                          </p>
                          <p className="text-2xl font-bold text-warning">—</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Shipping Tab */}
              <TabsContent value="shipping" className="h-full space-y-6">
                <div className="space-y-6">
                  <div className="space-y-4">
                    <Label>
                      <Controller
                        name="requires_shipping"
                        control={form.control}
                        render={({ field }) => (
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        )}
                      />
                      <span className="ml-2">This is a physical product</span>
                    </Label>
                    <p className="text-sm text-muted-foreground ml-6">
                      Uncheck for digital products or services that don&apos;t
                      require shipping.
                    </p>
                  </div>

                  <div
                    className="grid gap-4 sm:grid-cols-2"
                    style={{
                      display: form.watch("requires_shipping")
                        ? "grid"
                        : "none",
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="weight_grams">Weight</Label>
                      <div className="flex gap-2">
                        <Input
                          id="weight_grams"
                          type="number"
                          min="0"
                          step="1"
                          {...form.register("weight_grams")}
                          placeholder="0"
                        />
                        <Select
                          value={form.watch("weight_unit")}
                          onValueChange={(v) =>
                            form.setValue(
                              "weight_unit",
                              v as "g" | "kg" | "oz" | "lb" | undefined,
                            )
                          }
                        >
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
                      <Label htmlFor="hs_code">
                        HS (Harmonized System) code
                      </Label>
                      <Input
                        id="hs_code"
                        {...form.register("hs_code")}
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
                        {...form.register("country_of_origin")}
                        placeholder="ISO code (e.g., IN, US, CN)"
                        maxLength={2}
                        style={{ textTransform: "uppercase" }}
                      />
                      <p className="text-xs text-muted-foreground">
                        ISO 3166-1 alpha-2 code.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* SEO Tab */}
              <TabsContent value="seo" className="h-full space-y-6">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-medium mb-2">
                      Search engine listing preview
                    </h3>
                    <Card className="p-4 border-border/50 bg-muted/30">
                      <div className="space-y-2 font-mono text-sm">
                        <p className="text-brand">
                          {form.watch("handle")
                            ? `yourstore.com/products/${form.watch("handle")}`
                            : "yourstore.com/products/..."}
                        </p>
                        <p className="text-body font-medium truncate max-w-[400px]">
                          {form.watch("seo_title") ||
                            form.watch("name") ||
                            "Product title"}
                        </p>
                        <p className="text-muted-foreground line-clamp-2 max-w-[400px]">
                          {form.watch("seo_description") ||
                            form.watch("description") ||
                            "Product description will appear here..."}
                        </p>
                      </div>
                    </Card>
                  </div>

                  <Separator />

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label htmlFor="seo_title">
                        Page title{" "}
                        <span className="text-muted-foreground">
                          (max 70 characters)
                        </span>
                      </Label>
                      <Input
                        id="seo_title"
                        {...form.register("seo_title")}
                        maxLength={70}
                        placeholder="Product title for search results"
                      />
                      <div className="flex justify-end text-xs text-muted-foreground">
                        {(form.watch("seo_title") ?? "").length}/70
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="seo_description">
                        Meta description{" "}
                        <span className="text-muted-foreground">
                          (max 320 characters)
                        </span>
                      </Label>
                      <Textarea
                        id="seo_description"
                        {...form.register("seo_description")}
                        maxLength={320}
                        rows={3}
                        placeholder="Description for search results"
                      />
                      <div className="flex justify-end text-xs text-muted-foreground">
                        {(form.watch("seo_description") ?? "").length}/320
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="handle">URL handle</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          yourstore.com/products/
                        </span>
                        <Input
                          id="handle"
                          {...form.register("handle")}
                          maxLength={255}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Auto-generated from title. Changing this will change the
                        product URL.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* Organization Tab */}
              <TabsContent value="organization" className="h-full space-y-6">
                <div className="space-y-6">
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <Label htmlFor="category_id">Category</Label>
                      <Select
                        value={form.watch("category_id") || ""}
                        onValueChange={(v) =>
                          form.setValue("category_id", v || null)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
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
                    </div>

                    <div className="space-y-4">
                      <Label htmlFor="published_scope">Sales channels</Label>
                      <Select
                        value={form.watch("published_scope")}
                        onValueChange={(v) =>
                          form.setValue(
                            "published_scope",
                            v as "web" | "global",
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="web">Online store</SelectItem>
                          <SelectItem value="global">
                            All sales channels
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-sm text-muted-foreground">
                        Choose where this product is available for sale.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Sticky Footer inside form */}
            <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-4 lg:pl-56">
              <div className="mx-auto flex max-w-4xl items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting
                    ? "Saving..."
                    : isEdit
                      ? "Save"
                      : "Create product"}
                </Button>
              </div>
            </div>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
