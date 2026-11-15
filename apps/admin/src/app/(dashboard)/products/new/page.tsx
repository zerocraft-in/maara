"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import ProductForm from "../product-form";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type CategoryOption = {
  id: string;
  name: string;
  status: string;
};

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
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

      // Get active organization from session
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

      if (error) {
        console.error("Failed to load categories:", error);
        toast.error("Failed to load categories");
      } else {
        setCategories((data ?? []) as CategoryOption[]);
      }
      setLoading(false);
    }

    loadData();
  }, [router]);

  if (loading || !organizationId) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      </div>
    );
  }

  const handleSuccess = () => {
    toast.success("Product created successfully.");
    router.push("/products");
  };

  const handleClose = () => {
    router.push("/products");
  };

  return (
    <ProductForm
      mode="create"
      organizationId={organizationId}
      categories={categories}
      onSuccess={handleSuccess}
      onClose={handleClose}
    />
  );
}