"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import VariantForm from "../../../../variant-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ProductData = {
  id: string;
  name: string;
  status: string;
};

type VariantData = {
  id: string;
  sku: string;
  barcode: string | null;
  size: string | null;
  colour: string | null;
  cost_price_paise: number;
  selling_price_paise: number;
  tax_rate_bps: number | null;
  reorder_point: number;
};

export default function EditVariantPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  const variantId = params.variantId as string;
  
  const [product, setProduct] = React.useState<ProductData | null>(null);
  const [variant, setVariant] = React.useState<VariantData | null>(null);
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

      const [productResult, variantResult] = await Promise.all([
        supabase
          .from("products")
          .select("id, name, status")
          .eq("organization_id", orgId)
          .eq("id", productId)
          .maybeSingle(),
        supabase
          .from("product_variants")
          .select("id, sku, barcode, size, colour, cost_price_paise, selling_price_paise, tax_rate_bps, reorder_point")
          .eq("organization_id", orgId)
          .eq("product_id", productId)
          .eq("id", variantId)
          .maybeSingle(),
      ]);

      if (productResult.error) {
        console.error("Failed to load product:", productResult.error);
        toast.error("Failed to load product");
        router.push("/products");
      } else if (!productResult.data) {
        toast.error("Product not found");
        router.push("/products");
      } else if (productResult.data.status === "archived") {
        router.push(`/products/${productId}`);
      } else {
        setProduct(productResult.data as ProductData);
      }

      if (variantResult.error) {
        console.error("Failed to load variant:", variantResult.error);
        toast.error("Failed to load variant");
        router.push(`/products/${productId}`);
      } else if (!variantResult.data) {
        toast.error("Variant not found");
        router.push(`/products/${productId}`);
      } else {
        setVariant(variantResult.data as VariantData);
      }
      setLoading(false);
    }

    loadData();
  }, [productId, variantId, router]);

  if (loading) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      </div>
    );
  }

  if (!product || !variant) {
    return null;
  }

  const handleSuccess = () => {
    toast.success("Variant updated.");
    router.push(`/products/${productId}`);
  };

  const handleClose = () => {
    router.push(`/products/${productId}`);
  };

  return (
    <VariantForm
      mode="edit"
      productId={product.id}
      productName={product.name}
      variant={variant}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  );
}