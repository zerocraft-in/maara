"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import VariantForm from "../../../variant-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ProductData = {
  id: string;
  name: string;
  status: string;
};

export default function NewVariantPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;
  
  const [product, setProduct] = React.useState<ProductData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadProduct() {
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

      const { data, error } = await supabase
        .from("products")
        .select("id, name, status")
        .eq("organization_id", membership.organization_id)
        .eq("id", productId)
        .maybeSingle();

      if (error) {
        console.error("Failed to load product:", error);
        toast.error("Failed to load product");
        router.push("/products");
      } else if (!data) {
        toast.error("Product not found");
        router.push("/products");
      } else if (data.status === "archived") {
        router.push(`/products/${productId}`);
      } else {
        setProduct(data as ProductData);
      }
      setLoading(false);
    }

    loadProduct();
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

  if (!product) {
    return null;
  }

  const handleSuccess = () => {
    toast.success("Variant added.");
    router.push(`/products/${productId}`);
  };

  const handleClose = () => {
    router.push(`/products/${productId}`);
  };

  return (
    <VariantForm
      mode="create"
      productId={product.id}
      productName={product.name}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  );
}