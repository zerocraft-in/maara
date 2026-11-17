"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import ProductForm from "../product-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type CategoryOption = {
  id: string;
  name: string;
  status: string;
};

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

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [product, setProduct] = React.useState<ProductData | null>(null);
  const [organizationId, setOrganizationId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

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

      const orgId = membership.organization_id;
      setOrganizationId(orgId);

      // Load categories and product in parallel
      const [categoriesResult, productResult, optionsResult, imagesResult] =
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
                "hs_code, country_of_origin, seo_title, seo_description, published_scope, status"
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
            .from("product_images")
            .select(
              "id, product_id, variant_ids, src, alt, position, width, height, created_at, updated_at",
            )
            .eq("organization_id", orgId)
            .eq("product_id", productId)
            .order("position", { ascending: true }),
        ]);

      if (imagesResult.error) {
        console.error("Failed to load product images:", imagesResult.error);
      } else {
        const images = (imagesResult.data ?? []).map((img) => ({
          id: img.id,
          product_id: img.product_id,
          variant_ids: img.variant_ids ?? [],
          src: img.src,
          alt: img.alt ?? null,
          position: img.position,
          width: img.width ?? null,
          height: img.height ?? null,
        }));
        setProduct((prev) =>
          prev ? { ...prev, images } : null,
        );
      }

      if (categoriesResult.error) {
        console.error("Failed to load categories:", categoriesResult.error);
        toast.error("Failed to load categories");
      } else {
        setCategories((categoriesResult.data ?? []) as CategoryOption[]);
      }

      if (optionsResult.error) {
        console.error("Failed to load options:", optionsResult.error);
      }

      if (productResult.error) {
        console.error("Failed to load product:", productResult.error);
        toast.error("Failed to load product");
        router.push("/products");
      } else if (!productResult.data) {
        toast.error("Product not found");
        router.push("/products");
      } else {
        const productData = productResult.data as unknown as ProductData;
        setProduct({
          ...productData,
          product_options: (optionsResult.data ?? []) as ProductData["product_options"],
        });
      }
      setLoading(false);
    }

    loadData();
  }, [productId, router]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      </div>
    );
  }

  if (!product || !organizationId) {
    return null;
  }

  const handleSuccess = () => {
    toast.success("Product updated successfully.");
    router.push(`/products/${productId}`);
  };

  const handleClose = () => {
    router.push(`/products/${productId}`);
  };

  return (
    <ProductForm
      mode="edit"
      organizationId={organizationId!}
      categories={categories}
      product={product}
      images={product.images ?? []}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  );
}