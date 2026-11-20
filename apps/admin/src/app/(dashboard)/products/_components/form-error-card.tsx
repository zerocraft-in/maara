"use client";

import { CircleAlert } from "lucide-react";
import type { FieldErrors } from "react-hook-form";
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

    if (field === "root") {
      return Object.values(error).flatMap((rootError) => {
        if (!rootError || typeof rootError !== "object") return [];
        const message = "message" in rootError ? rootError.message : undefined;
        return typeof message === "string" && message ? [message] : [];
      });
    }

    const message = "message" in error ? error.message : undefined;
    if (typeof message !== "string" || !message) return [];

    const label = FIELD_LABELS[field] ?? field;
    const displayMessage =
      field === "name" && /at least 2 characters/i.test(message)
        ? "Title can't be blank"
        : message;

    return [{
      field: label,
      message: displayMessage,
    }];
  });

  if (messages.length === 0) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="mb-6 rounded-[16px] bg-[#ffe5e5] px-4 py-3 text-[#202223]"
    >
      <div className="flex items-start gap-2">
        <CircleAlert
          className="mt-0.5 size-4 shrink-0 fill-[#d72c0d] text-white"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-[14px] font-semibold leading-5">
            There {messages.length === 1 ? "is" : "are"} {messages.length} {messages.length === 1 ? "error" : "errors"} with this product:
          </p>
          <ul className="mt-2 space-y-1 text-[13px] leading-5 text-[#6d1b0b]">
            {messages.map((item, index) => {
              const message = typeof item === "string" ? item : `${item.field}: ${item.message}`;
              return <li key={`${message}-${index}`}>{message}</li>;
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
