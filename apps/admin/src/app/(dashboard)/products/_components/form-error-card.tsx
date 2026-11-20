"use client";

import { AlertTriangle } from "lucide-react";
import type { FieldErrors } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProductFormValues } from "@/app/(dashboard)/products/lib/product-schema";

interface FormErrorCardProps {
  errors: FieldErrors<ProductFormValues>;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Title",
  description: "Description",
  category_id: "Category",
  price: "Price",
  compare_at_price: "Compare-at price",
  tax_rate_percent: "Tax rate",
  barcode: "Barcode",
  weight: "Weight",
  country_of_origin: "Country of origin",
  seo_title: "SEO page title",
  seo_description: "SEO meta description",
  handle: "URL handle",
  status: "Status",
  options: "Product options",
};

export function FormErrorCard({ errors }: FormErrorCardProps) {
  const messages = Object.entries(errors).flatMap(([field, error]) => {
    if (!error || typeof error !== "object") return [];
    const message = "message" in error ? error.message : undefined;
    if (typeof message !== "string" || !message) return [];

    return [{
      field: FIELD_LABELS[field] ?? field,
      message,
    }];
  });

  if (messages.length === 0) return null;

  return (
    <Card
      role="alert"
      aria-live="assertive"
      className="mb-6 border-[#d72c0d] bg-[#fff4f4] shadow-none"
    >
      <CardHeader className="flex flex-row items-start gap-2 px-4 pb-2 pt-4">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#d72c0d]" aria-hidden="true" />
        <CardTitle className="text-[14px] font-semibold text-[#202223]">
          Fix the following errors before saving
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0">
        <ul className="list-disc space-y-1 pl-5 text-[13px] leading-5 text-[#6d1b0b]">
          {messages.map(({ field, message }) => (
            <li key={`${field}-${message}`}>
              <span className="font-medium">{field}:</span> {message}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
