"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";
import { slugify } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { createProduct, createVariant, createProductImage } from "../actions";
import type { CategoryOption } from "../types";
import { useDirtyForm } from "@/components/providers/dirty-provider";
import { useProductFormState } from "@/app/(dashboard)/products/lib/product-form-state";
import {
  productFormSchema,
  type ProductFormValues,
  parseMoney,
  normalizeWeightToGrams,
  computeProfitMargin,
} from "@/app/(dashboard)/products/lib/product-schema";
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

export default function NewProductPage() {
  const router = useRouter();

  const [organizationId, setOrganizationId] = React.useState<string | null>(
    null,
  );
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [mediaPickerOpen, setMediaPickerOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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

  const onSubmit = async (values: ProductFormValues) => {
    if (!organizationId) return;

    setIsSubmitting(true);

    // Cross-field validation: compare-at price vs price.
    const priceRelationshipErrors = {
      ...(values.compare_at_price &&
      values.price &&
      Number(values.compare_at_price) < Number(values.price)
        ? { compare_at_price: "Compare-at price cannot be lower than price." }
        : {}),
    };

    if (Object.keys(priceRelationshipErrors).length > 0) {
      form.setError("compare_at_price", {
        message: priceRelationshipErrors.compare_at_price!,
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

    const pricePaise = parseMoney(values.price);
    const costPaise = parseMoney(values.cost_per_item);
    const { profit, margin } = computeProfitMargin(pricePaise, costPaise);

    const weightGrams = normalizeWeightToGrams(
      values.weight ?? null,
      values.weight_unit,
    );

    const payload = {
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
      // Variant-level data
      variants,
      profit_paise: profit ?? null,
      margin_percent: margin ?? null,
      images: selectedMedia.map((m, i) => ({
        src: m.url,
        alt: m.name,
        position: i + 1,
      })),
    };

    try {
      const result = await createProduct(payload);

      if (!result.ok) {
        toast.add({ title: result.error, type: "error" });
        return;
      }

      const productId = result.id as string;

      // Persist variants atomically after the base product exists.
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

        const variantResult = await createVariant({
          product_id: productId,
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
        });

        if (!variantResult.ok) {
          toast.add({ title: variantResult.error, type: "error" });
          return;
        }
      }

      // Persist media.
      for (const [index, media] of selectedMedia.entries()) {
        const imageResult = await createProductImage({
          product_id: productId,
          variant_ids: [],
          src: media.url,
          alt: media.name,
          position: index + 1,
        });
        if (!imageResult.ok) {
          toast.add({ title: imageResult.error, type: "error" });
          return;
        }
      }

      // Mark the current values as the saved baseline before navigating so
      // the dirty bar closes immediately instead of surviving the transition.
      form.reset(form.getValues());
      toast.add({ title: "Product created.", type: "success" });
      router.push("/products");
    } catch {
      toast.add({ title: "Please try again.", type: "error" });
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
      clearSelectedMedia();
      router.push("/products");
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
      <div className="product-create-page relative min-h-full bg-white text-[#202223]">
      <div className="relative mx-auto flex max-w-[1088px] flex-col overflow-visible px-4 py-4 sm:px-0 lg:py-6">
        <div className="mb-6">
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em] text-[#202223]">
            Add product
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
