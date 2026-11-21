"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import { createCategory, updateCategory } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Category name must be at least 2 characters")
    .max(120, "Category name must be at most 120 characters"),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be at most 1000 characters")
    .optional()
    .or(z.literal("")),
  sort_order: z
    .string()
    .trim()
    .regex(
      /^\d{1,6}$/,
      "Sort order must be a whole number from 0 to 999999",
    ),
});

type CategoryFormValues = z.infer<typeof categorySchema>;

type CategoryFormMode = "create" | "edit";

interface CategoryFormProps {
  mode: CategoryFormMode;
  category?: {
    id: string;
    name: string;
    description: string | null;
    sort_order: number;
  };
  onSuccess: () => void;
  onClose: () => void;
}

export default function CategoryForm({
  mode,
  category,
  onSuccess,
  onClose,
}: CategoryFormProps) {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category?.name ?? "",
      description: category?.description ?? "",
      sort_order: String(category?.sort_order ?? 0),
    },
  });

  const isEdit = mode === "edit";
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const onSubmit = async (values: CategoryFormValues) => {
    setSubmitError(null);
    setIsSubmitting(true);

    const payload = {
      name: values.name,
      description: values.description,
      sort_order: Number(values.sort_order),
    };

    try {
      const result = isEdit
        ? await updateCategory({ ...payload, id: category!.id })
        : await createCategory(payload);

      if (result.ok) {
        onSuccess();
      } else {
        setSubmitError(result.error);
      }
    } catch {
      setSubmitError("An unexpected error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{isEdit ? "Edit Category" : "Create Category"}</CardTitle>
        <CardDescription>
          {isEdit
            ? "Update category details. Status cannot be changed here."
            : "Add a new product category."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex w-full max-w-md flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-body">
              Category name
            </label>
            <input
              {...form.register("name")}
              placeholder="e.g. Shirts"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-body">
              Description
            </label>
            <textarea
              {...form.register("description")}
              rows={3}
              placeholder="Optional description"
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {form.formState.errors.description && (
              <p className="text-xs text-destructive">
                {form.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-body">
              Sort order
            </label>
            <input
              {...form.register("sort_order")}
              type="number"
              min={0}
              max={999999}
              step={1}
              placeholder="0"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {form.formState.errors.sort_order && (
              <p className="text-xs text-destructive">
                {form.formState.errors.sort_order.message}
              </p>
            )}
          </div>

          {submitError && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              {submitError}
            </div>
          )}

          <Separator className="mt-4 mb-4" />

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create Category"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
