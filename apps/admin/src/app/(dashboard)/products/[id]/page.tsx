"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { slugify } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import {
  updateProduct,
  updateVariant,
  createVariant,
  createProductImage,
  updateProductImage,
  deleteProductImage,
} from "../actions";
import type { CategoryOption } from "../types";
import { useDirtyForm } from "@/components/providers/dirty-provider";
import { useProductFormState } from "@/app/(dashboard)/products/lib/product-form-state";
import {
  productFormSchema,
  type ProductFormValues,
  parseMoney,
  normalizeWeightToGrams,
  formatMoneyInput,
} from "@/app/(dashboard)/products/lib/product-schema";
import { Paise } from "@/lib/money";
import { validateVariants } from "@/app/(dashboard)/products/lib/variant-generator";
import { MediaPicker } from "@/components/media-picker/media-picker";
import { PricingSection } from "../_components/pricing-section";
import { ProductIdentityCard } from "../_components/product-identity-card";
import { InventoryCard } from "../_components/inventory-card";
import { ShippingCard } from "../_components/shipping-card";
import { VariantsSection } from "../_components/variants-section";
import { MetafieldsCard } from "../_components/metafields-card";
import { SeoSection } from "../_components/seo-section";
import { StatusCard } from "../_components/status-card";
import { PublishingCard } from "../_components/publishing-card";
import { OrganizationCard } from "../_components/organization-card";
import { FormErrorCard } from "../_components/form-error-card";
import { PageHeader } from "@/components/layout/page-header";

type ProductData = {
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
  product_variants: Array<{
    id: string;
    sku: string;
    barcode: string | null;
    option1: string | null;
    option2: string | null;
    option3: string | null;
    cost_price_paise: number;
    selling_price_paise: number;
    compare_at_price_paise: number | null;
    cost_per_item_paise: number;
    track_quantity: boolean;
    quantity: number;
    continue_selling_when_out_of_stock: boolean;
    weight_grams: number | null;
    weight_unit: "g" | "kg" | "oz" | "lb";
    requires_shipping: boolean;
    is_active: boolean;
  }>;
  images: Array<{
    id: string;
    product_id?: string;
    variant_ids: string[];
    src: string;
    alt: string | null;
    position: number;
    width: number | null;
    height: number | null;
  }>;
};

function variantKey(v: {
  option1: string | null;
  option2: string | null;
  option3: string | null;
}) {
  return [v.option1, v.option2, v.option3]
    .filter(Boolean)
    .map((v) => v!.trim())
    .join("|");
}

function gramsToDisplay(
  grams: number | null,
  unit: "g" | "kg" | "oz" | "lb",
): string {
  if (!grams) return "";
  switch (unit) {
    case "g":
      return String(grams);
    case "kg":
      return String(grams / 1000);
    case "oz":
      return String((grams / 28.3495).toFixed(3));
    case "lb":
      return String((grams / 453.592).toFixed(3));
    default:
      return String(grams);
  }
}

/** Convert integer paise (from DB) to a two-decimal string for form inputs. */
function toMoneyInput(paise: number | null): string {
  return formatMoneyInput((paise ?? 0) as unknown as Paise);
}

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [organizationId, setOrganizationId] = React.useState<string | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [existingImages, setExistingImages] = React.useState<Array<{
    id: string;
    src: string;
  }>>([]);
  const [loadedVariants, setLoadedVariants] = React.useState<
    ProductData["product_variants"]
  >([]);
  const [variantsOverlaid, setVariantsOverlaid] = React.useState(false);

  // Shared form state (options, variants, media, section flags).
  const {
    variants,
    selectedMedia,
    setSelectedMedia,
    clearSelectedMedia,
    inventoryOpen,
    setInventoryOpen,
    shippingOpen,
    setShippingOpen,
    seoOpen,
    setSeoOpen,
    setOptions,
    setVariantField,
  } = useProductFormState();

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<
      ProductFormValues,
      unknown,
      ProductFormValues
    >,
    defaultValues: {
      name: "",
      description: "",
      handle: "",
      vendor: "",
      product_type: "",
      tags: [],
      category_id: null,
      price: "",
      compare_at_price: "",
      cost_per_item: "",
      is_tax_inclusive: false,
      tax_rate_percent: "",
      unit_price_total_amount: "",
      unit_price_total_amount_unit: "g",
      unit_price_base_measure: "1",
      unit_price_base_measure_unit: "g",
      track_quantity: true,
      quantity: "0",
      continue_selling_when_out_of_stock: false,
      sku: "",
      barcode: "",
      requires_shipping: true,
      weight: "",
      weight_unit: "g",
      packed_length: "",
      packed_width: "",
      packed_height: "",
      dimension_unit: "cm",
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

  // Load product, categories, options, variants, images.
  React.useEffect(() => {
    let cancelled = false;

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

      const orgId = membership.organization_id;
      setOrganizationId(orgId);

      const [categoriesResult, productResult, optionsResult, variantsResult, imagesResult] =
        await Promise.all([
          supabase
            .from("categories")
            .select("id, name, status")
            .eq("organization_id", orgId)
            .order("name", { ascending: true }),
          supabase
            .from("products")
            .select(
              "id, name, category_id, description, handle, vendor, product_type, tags, " +
                "tax_rate_bps, is_tax_inclusive, requires_shipping, weight_grams, weight_unit, " +
                "hs_code, country_of_origin, seo_title, seo_description, published_scope, status",
            )
            .eq("organization_id", orgId)
            .eq("id", productId)
            .maybeSingle(),
          supabase
            .from("product_options")
            .select("id, name, position, values")
            .eq("organization_id", orgId)
            .eq("product_id", productId)
            .order("position", { ascending: true }),
          supabase
            .from("product_variants")
            .select(
              "id, sku, barcode, option1, option2, option3, cost_price_paise, selling_price_paise, compare_at_price_paise, cost_per_item_paise, track_quantity, quantity, continue_selling_when_out_of_stock, weight_grams, weight_unit, requires_shipping, is_active",
            )
            .eq("organization_id", orgId)
            .eq("product_id", productId)
            .order("sku", { ascending: true }),
          supabase
            .from("product_images")
            .select(
              "id, product_id, variant_ids, src, alt, position, width, height, created_at, updated_at",
            )
            .eq("organization_id", orgId)
            .eq("product_id", productId)
            .order("position", { ascending: true }),
        ]);

      if (cancelled) return;

      if (categoriesResult.error) {
        console.error("Failed to load categories:", categoriesResult.error);
        toast.add({ title: "Failed to load categories", type: "error" });
      } else {
        setCategories((categoriesResult.data ?? []) as CategoryOption[]);
      }

      if (productResult.error) {
        console.error("Failed to load product:", productResult.error);
        toast.add({ title: "Failed to load product", type: "error" });
        router.push("/products");
        setLoading(false);
        return;
      }

      if (!productResult.data) {
        toast.add({ title: "Product not found", type: "error" });
        router.push("/products");
        setLoading(false);
        return;
      }

      const product = productResult.data as unknown as ProductData;

      // Product-level pricing lives on variants; seed from the first variant.
      const primaryVariant = (variantsResult.data ?? [])[0];

      // Seed form scalar fields from the existing product.
      const taxPercent = product.tax_rate_bps
        ? (product.tax_rate_bps / 100).toFixed(2)
        : "";
      form.reset({
        name: product.name,
        description: product.description ?? "",
        handle: product.handle,
        vendor: product.vendor ?? "",
        product_type: product.product_type ?? "",
        tags: product.tags ?? [],
        category_id: product.category_id,
        price: toMoneyInput(primaryVariant?.selling_price_paise ?? null),
        compare_at_price: toMoneyInput(
          primaryVariant?.compare_at_price_paise ?? null,
        ),
        cost_per_item: toMoneyInput(primaryVariant?.cost_per_item_paise ?? null),
        is_tax_inclusive: product.is_tax_inclusive,
        tax_rate_percent: taxPercent,
        requires_shipping: product.requires_shipping,
        weight: gramsToDisplay(product.weight_grams, product.weight_unit),
        weight_unit: product.weight_unit,
        packed_length: "",
        packed_width: "",
        packed_height: "",
        dimension_unit: "cm",
        hs_code: product.hs_code ?? "",
        country_of_origin: product.country_of_origin ?? "",
        seo_title: product.seo_title ?? "",
        seo_description: product.seo_description ?? "",
        published_scope: product.published_scope,
        status: product.status as "draft" | "active" | "archived",
        options: (optionsResult.data ?? []).map((o) => ({
          name: o.name,
          values: o.values,
        })),
      });

      // Seed shared options (regenerates default variant matrix asynchronously).
      setOptions((optionsResult.data ?? []).map((o) => ({
        name: o.name,
        values: o.values,
      })));

      // Keep loaded variants for the overlay effect (runs after matrix exists).
      setLoadedVariants(variantsResult.data ?? []);
      setExistingImages(
        (imagesResult.data ?? []).map((img) => ({ id: img.id, src: img.src })),
      );

      // Seed selected media from existing images.
      setSelectedMedia(
        (imagesResult.data ?? []).map((img) => ({
          id: img.id,
          key: img.id,
          name: img.alt ?? img.src.split("/").pop() ?? "Image",
          url: img.src,
          contentType: null,
          size: 0,
          organizationId: orgId,
        })),
      );

      setLoading(false);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [productId, router, setOptions, form, setSelectedMedia]);

  // Overlay loaded variant data onto the generated matrix by option tuple.
  React.useEffect(() => {
    if (variantsOverlaid || loadedVariants.length === 0) return;
    if (variants.length === 0) return;

    loadedVariants.forEach((lv) => {
      const key = variantKey(lv);
      const idx = variants.findIndex((v) => variantKey(v) === key);
      if (idx === -1) return;
      setVariantField(idx, "id", lv.id);
      setVariantField(idx, "sku", lv.sku);
      setVariantField(idx, "barcode", lv.barcode ?? null);
      setVariantField(idx, "price", toMoneyInput(lv.selling_price_paise));
      setVariantField(
        idx,
        "compare_at_price",
        toMoneyInput(lv.compare_at_price_paise),
      );
      setVariantField(idx, "cost_per_item", toMoneyInput(lv.cost_per_item_paise));
      setVariantField(idx, "track_quantity", lv.track_quantity);
      setVariantField(idx, "quantity", String(lv.quantity ?? 0));
      setVariantField(
        idx,
        "continue_selling_when_out_of_stock",
        lv.continue_selling_when_out_of_stock,
      );
      setVariantField(
        idx,
        "weight",
        gramsToDisplay(lv.weight_grams, lv.weight_unit),
      );
      setVariantField(idx, "weight_unit", lv.weight_unit);
      setVariantField(idx, "requires_shipping", lv.requires_shipping);
      setVariantField(idx, "is_active", lv.is_active);
    });

    setVariantsOverlaid(true);
  }, [variants, loadedVariants, variantsOverlaid, setVariantField]);

  const onSubmit = async (values: ProductFormValues) => {
    if (!organizationId) return;

    setIsSubmitting(true);

    // Cross-field validation: compare-at price vs price.
    if (
      values.compare_at_price &&
      values.price &&
      Number(values.compare_at_price) < Number(values.price)
    ) {
      form.setError("compare_at_price", {
        message: "Compare-at price cannot be lower than price.",
      });
      toast.add({ title: "Review the highlighted fields before saving.", type: "error" });
      setIsSubmitting(false);
      return;
    }

    // Validate variants.
    const variantErrors = validateVariants(variants);
    if (Object.keys(variantErrors).length > 0) {
      toast.add({ title: "Please fix variant errors before saving.", type: "error" });
      setIsSubmitting(false);
      return;
    }

    const weightGrams = normalizeWeightToGrams(
      values.weight ?? null,
      values.weight_unit,
    );

    const payload = {
      id: productId,
      name: values.name,
      description: values.description || null,
      handle: values.handle || slugify(values.name),
      vendor: values.vendor || null,
      product_type: values.product_type || null,
      tags: values.tags,
      category_id: values.category_id,
      tax_rate_bps: values.tax_rate_percent
        ? Math.round(Number(values.tax_rate_percent) * 100)
        : 0,
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
      const productResult = await updateProduct(payload);

      if (!productResult.ok) {
        toast.add({ title: productResult.error, type: "error" });
        return;
      }

      // Upsert variants: update existing, create new.
      const trackQty = values.track_quantity;
      for (const variant of variants) {
        const sellingPrice = parseMoney(variant.price);
        const cost = parseMoney(variant.cost_per_item);
        const compareAt = variant.compare_at_price
          ? parseMoney(variant.compare_at_price)
          : null;
        const weightGrams = variant.weight
          ? normalizeWeightToGrams(variant.weight, variant.weight_unit)
          : null;

        const baseVariantInput = {
          sku: variant.sku,
          barcode: variant.barcode ?? undefined,
          option1: variant.option1 ?? undefined,
          option2: variant.option2 ?? undefined,
          option3: variant.option3 ?? undefined,
          cost_price_paise: cost ?? 0,
          selling_price_paise: sellingPrice ?? 0,
          compare_at_price_paise: compareAt ?? null,
          cost_per_item_paise: cost ?? 0,
          tax_rate_bps: values.tax_rate_percent
            ? Math.round(Number(values.tax_rate_percent) * 100)
            : 0,
          track_quantity: trackQty,
          quantity: Number(variant.quantity) || 0,
          continue_selling_when_out_of_stock:
            variant.continue_selling_when_out_of_stock,
          weight_grams: weightGrams,
          weight_unit: variant.weight_unit,
          requires_shipping: variant.requires_shipping,
          reorder_point: 0,
        };

        if (variant.id) {
          const result = await updateVariant({
            id: variant.id,
            ...baseVariantInput,
          });
          if (!result.ok) {
            toast.add({ title: result.error, type: "error" });
            return;
          }
        } else {
          const result = await createVariant({
            product_id: productId,
            ...baseVariantInput,
          });
          if (!result.ok) {
            toast.add({ title: result.error, type: "error" });
            return;
          }
        }
      }

      // Sync media: create new, update existing, delete removed.
      const existingBySrc = new Map(
        existingImages.map((img) => [img.src, img]),
      );

      for (const [index, media] of selectedMedia.entries()) {
        if (existingBySrc.has(media.url)) {
          const img = existingBySrc.get(media.url)!;
          await updateProductImage({
            id: img.id,
            alt: media.name,
            position: index + 1,
          });
        } else {
          await createProductImage({
            product_id: productId,
            variant_ids: [],
            src: media.url,
            alt: media.name,
            position: index + 1,
          });
        }
      }

      // Remove images no longer selected.
      const selectedSrcs = new Set(selectedMedia.map((m) => m.url));
      for (const img of existingImages) {
        if (!selectedSrcs.has(img.src) && img.id) {
          await deleteProductImage({ id: img.id });
        }
      }

      // Reset the dirty baseline before routing back to the saved product.
      form.reset(form.getValues());
      toast.add({ title: "changes saved.", type: "success" });
      router.push(`/products/${productId}`);
    } catch {
      toast.add({ title: "Please try again.", type: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  useDirtyForm({
    dirty: form.formState.isDirty,
    saving: isSubmitting,
    label: "Unsaved changes",
    onDiscard: () => {
      form.reset();
      clearSelectedMedia();
      router.push(`/products/${productId}`);
    },
    onSave: () => {
      void form.handleSubmit(onSubmit, () => {
        toast.add({ title: "Review the highlighted fields before saving.", type: "error" });
      })();
    },
  });

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
    <PageHeader>
      <div className="product-edit-page relative min-h-full bg-white text-[#202223]">
      <div className="relative mx-auto flex max-w-[1088px] flex-col overflow-visible px-4 py-4 sm:px-0 lg:py-6">
        <div className="mb-6 flex items-center gap-2">
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-[#202223]">
            Edit product
          </h1>
        </div>
        <FormErrorCard errors={form.formState.errors} />
        <form
          id="product-form"
          onSubmit={form.handleSubmit(onSubmit, () => {
            toast.add({ title: "Review the highlighted fields before saving.", type: "error" });
          })}
          className="grid gap-8 xl:grid-cols-[minmax(0,760px)_280px] xl:gap-12"
        >
          {/* Left column - main form */}
          <div className="space-y-8">
            <ProductIdentityCard
              form={form}
              categories={categories}
              selectedMedia={selectedMedia}
              setMediaPickerOpen={setMediaPickerOpen}
            />
            <PricingSection form={form} />
            <InventoryCard
              form={form}
              inventoryOpen={inventoryOpen}
              setInventoryOpen={setInventoryOpen}
            />
            <ShippingCard
              form={form}
              shippingOpen={shippingOpen}
              setShippingOpen={setShippingOpen}
            />
            <VariantsSection />
            <MetafieldsCard />
            <SeoSection
              form={form}
              seoOpen={seoOpen}
              setSeoOpen={setSeoOpen}
            />
          </div>

          {/* Right column - side panel */}
          <div className="space-y-5 xl:sticky xl:top-6">
            <StatusCard form={form} />
            <PublishingCard />
            <OrganizationCard form={form} />
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
            form.setValue("description", form.getValues("description"), {
              shouldDirty: true,
            });
          }}
          folder="products"
        />
      </div>
      </div>
    </PageHeader>
  );
}
