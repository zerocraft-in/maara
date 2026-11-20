"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "@/components/ui/toast";

import { archiveCategory, setCategoryStatus } from "./actions";
import CategoryForm from "./category-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

type CategoryRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  status: string;
  created_at: string;
};

interface CategoriesManagerProps {
  categories: CategoryRow[];
  canManage: boolean;
  errorMessage: string | null;
}

export default function CategoriesManager({
  categories,
  canManage,
  errorMessage,
}: CategoriesManagerProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "active" | "inactive"
  >("all");
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [editingCategory, setEditingCategory] =
    React.useState<CategoryRow | null>(null);
  const [isArchiving, setIsArchiving] = React.useState<string | null>(null);
  const [isChangingStatus, setIsChangingStatus] = React.useState<string | null>(
    null,
  );

  const router = useRouter();

  const filteredCategories = categories.filter((row) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query.length === 0 ||
      row.name.toLowerCase().includes(query) ||
      (row.description ?? "").toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" || row.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleArchive = async (categoryId: string) => {
    setIsArchiving(categoryId);
    try {
      const result = await archiveCategory({ id: categoryId });
      if (result.ok) {
        toast.add({ title: "Category archived.", type: "success" });
        await router.refresh();
      } else {
        toast.add({ title: result.error, type: "error" });
      }
    } finally {
      setIsArchiving(null);
    }
  };

  const handleStatusChange = async (
    categoryId: string,
    status: "active" | "inactive",
  ) => {
    setIsChangingStatus(categoryId);
    try {
      const result = await setCategoryStatus({ id: categoryId, status });
      if (result.ok) {
        toast.add({ title: status === "active" ? "Category reactivated." : "Category archived.", type: "success" });
        await router.refresh();
      } else {
        toast.add({ title: result.error, type: "error" });
      }
    } finally {
      setIsChangingStatus(null);
    }
  };

  if (errorMessage) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-body">{errorMessage}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-5 py-6 sm:px-8 sm:py-10">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="min-w-0 flex items-center gap-2">
          <div
            aria-hidden="true"
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand text-[13px] font-bold text-brand-fg"
          >
            M
          </div>
          <div className="min-w-0 leading-tight">
            <h2 className="text-sm font-semibold tracking-[-0.02em] text-body">
              Categories
            </h2>
            <p className="hidden text-2xs text-meta sm:block">
              Organise products into categories
            </p>
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setShowCreateForm(true)}
            >
              Create Category
            </Button>
          </div>
        )}
      </div>

      <Separator className="mt-4 mb-8" />

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="flex-none sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as "all" | "active" | "inactive")
            }
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="all">All Categories</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left pb-3">Name</th>
                  <th className="text-left pb-3">Description</th>
                  <th className="text-left pb-3">Sort Order</th>
                  <th className="text-left pb-3">Status</th>
                  <th className="text-left pb-3">Created</th>
                  {canManage && (
                    <th className="text-right pb-3">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCategories.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canManage ? 6 : 5}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No categories found.
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => setShowCreateForm(true)}
                          className="ml-2 text-xs text-brand-text underline underline-offset-4 hover:underline"
                        >
                          Create Category
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredCategories.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-3 text-body font-medium">
                        {row.name}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {row.description ? (
                          <span
                            title={row.description}
                            className="line-clamp-1 max-w-[24rem]"
                          >
                            {row.description}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {row.sort_order}
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            row.status === "active" ? "success" : "default"
                          }
                        >
                          {row.status.charAt(0).toUpperCase() +
                            row.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      {canManage ? (
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingCategory(row)}
                              className="text-xs text-brand-text hover:underline"
                              disabled={editingCategory !== null}
                            >
                              Edit
                            </button>
                            {row.status === "inactive" ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleStatusChange(row.id, "active")
                                }
                                className="text-xs text-brand-text hover:underline"
                                disabled={isChangingStatus === row.id}
                              >
                                {isChangingStatus === row.id
                                  ? "Reactivating..."
                                  : "Reactivate"}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      `Archive "${row.name}"? This will make the category inactive.`,
                                    )
                                  ) {
                                    handleArchive(row.id);
                                  }
                                }}
                                className="text-xs text-destructive hover:underline"
                                disabled={isArchiving === row.id}
                              >
                                {isArchiving === row.id
                                  ? "Archiving..."
                                  : "Archive"}
                              </button>
                            )}
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {showCreateForm && canManage && (
        <CategoryForm
          mode="create"
          onSuccess={() => {
            setShowCreateForm(false);
            toast.add({ title: "Category created successfully.", type: "success" });
            void router.refresh();
          }}
          onClose={() => setShowCreateForm(false)}
        />
      )}

      {editingCategory && canManage && (
        <CategoryForm
          mode="edit"
          category={{
            id: editingCategory.id,
            name: editingCategory.name,
            description: editingCategory.description,
            sort_order: editingCategory.sort_order,
          }}
          onSuccess={() => {
            setEditingCategory(null);
            toast.add({ title: "Category updated successfully.", type: "success" });
            void router.refresh();
          }}
          onClose={() => setEditingCategory(null)}
        />
      )}
    </div>
  );
}
