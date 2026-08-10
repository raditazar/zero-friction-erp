"use client";

import React, { type FormEvent } from "react";
import type { Category, Tag, TransactionType } from "@/lib/api";
import type { DraftCategory, DraftTag } from "../model";
import {
  FormCard,
  FormCardHeader,
  FormCardTitle,
  FormCardDescription,
  FormCardContent,
  FormField,
  TextField,
  NativeSelectField,
  SubmitAction,
} from "@/components/ui/form";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";

export type TaxonomyViewProps = {
  categories: Category[];
  tags: Tag[];
  categoryDraft: DraftCategory;
  tagDraft: DraftTag;
  setCategoryDraft: (draft: DraftCategory) => void;
  setTagDraft: (draft: DraftTag) => void;
  onCategorySubmit: (e: FormEvent) => void;
  onTagSubmit: (e: FormEvent) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteTag: (id: string) => void;
  loading?: boolean;
  loadError?: string;
  onRetry?: () => void;
  submitBusy?: "category" | "tag" | null;
  submitError?: string;
  deleteBusy?: "category" | "tag" | null;
  deleteError?: string;
};

const PRESET_COLORS = [
  { label: "Indigo", value: "#4F46E5" },
  { label: "Emerald", value: "#10B981" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Cyan", value: "#06B6D4" },
  { label: "Purple", value: "#8B5CF6" },
];

export function TaxonomyView({
  categories,
  tags,
  categoryDraft,
  tagDraft,
  setCategoryDraft,
  setTagDraft,
  onCategorySubmit,
  onTagSubmit,
  onDeleteCategory,
  onDeleteTag,
  loading = false,
  loadError = "",
  onRetry,
  submitBusy = null,
  submitError = "",
  deleteBusy = null,
  deleteError = "",
}: TaxonomyViewProps) {
  if (loading) return <LoadingState label="Memuat data taksonomi..." />;
  if (loadError) return <ErrorState title="Gagal Memuat Taksonomi" message={loadError} onRetry={onRetry} />;

  const parentCategoryMap = new Map(categories.map((c) => [c.id, c.name]));

  // Filter options for parent category: type must match and cannot select self
  const parentOptions = categories
    .filter((c) => c.type === categoryDraft.type && c.id !== categoryDraft.id)
    .map((c) => ({ label: c.name, value: c.id }));

  const expenseCategories = categories.filter((c) => c.type === "expense");
  const incomeCategories = categories.filter((c) => c.type === "income");

  const renderCategoryItem = (cat: Category) => {
    const parentName = cat.parent_id ? parentCategoryMap.get(cat.parent_id) : null;
    return (
      <div key={cat.id} className="flex items-center justify-between p-3 transition-colors hover:bg-gray-50 border-b border-gray-100 last:border-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-800">{cat.name}</span>
            {parentName && (
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                Parent: {parentName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() =>
              setCategoryDraft({
                id: cat.id,
                name: cat.name,
                type: cat.type,
                parent_id: cat.parent_id || "",
              })
            }
            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDeleteCategory(cat.id)}
            disabled={deleteBusy === "category"}
            className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
          >
            Hapus
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {(submitError || deleteError) && (
        <div className="p-4 mb-6 rounded-md bg-red-50 border border-red-200">
          <p className="text-sm text-red-700">{submitError || deleteError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Categories Section */}
        <div className="space-y-6">
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>{categoryDraft.id ? "Edit Kategori" : "Kategori Baru"}</FormCardTitle>
              <FormCardDescription>Kelola kategori pendapatan dan pengeluaran Anda.</FormCardDescription>
            </FormCardHeader>
            <FormCardContent>
              <form onSubmit={onCategorySubmit} className="space-y-4">
                <FormField label="Tipe Kategori">
                  <NativeSelectField
                    value={categoryDraft.type}
                    onChange={(e) =>
                      setCategoryDraft({
                        ...categoryDraft,
                        type: e.target.value as TransactionType,
                        parent_id: "",
                      })
                    }
                    disabled={!!categoryDraft.id}
                  >
                    <option value="income">Pendapatan</option>
                    <option value="expense">Pengeluaran</option>
                  </NativeSelectField>
                </FormField>

                <FormField label="Nama Kategori">
                  <TextField
                    placeholder="misal: Gaji, Listrik & Air"
                    value={categoryDraft.name}
                    onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
                    required
                  />
                </FormField>

                <FormField label="Kategori Parent (Opsional)">
                  <NativeSelectField
                    value={categoryDraft.parent_id || ""}
                    onChange={(e) => setCategoryDraft({ ...categoryDraft, parent_id: e.target.value })}
                  >
                    <option value="">Jadikan Root (Tanpa Parent)</option>
                    {parentOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </NativeSelectField>
                </FormField>

                <div className="pt-2 flex justify-end space-x-3">
                  {categoryDraft.id && (
                    <button
                      type="button"
                      onClick={() => setCategoryDraft({ name: "", type: "expense", parent_id: "" })}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      Batal
                    </button>
                  )}
                  <SubmitAction
                    isSubmitting={submitBusy === "category"}
                    label={categoryDraft.id ? "Perbarui Kategori" : "Tambah Kategori"}
                    busyLabel="Menyimpan..."
                  />
                </div>
              </form>
            </FormCardContent>
          </FormCard>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="text-lg font-medium text-gray-900">Kategori Pengeluaran</h3>
            </div>
            <div>
              {expenseCategories.length === 0 ? (
                <EmptyState title="Belum Ada Kategori Pengeluaran" description="Buat kategori pertama Anda di atas." />
              ) : (
                expenseCategories.map(renderCategoryItem)
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="text-lg font-medium text-gray-900">Kategori Pendapatan</h3>
            </div>
            <div>
              {incomeCategories.length === 0 ? (
                <EmptyState title="Belum Ada Kategori Pendapatan" description="Buat kategori pertama Anda di atas." />
              ) : (
                incomeCategories.map(renderCategoryItem)
              )}
            </div>
          </div>
        </div>

        {/* Tags Section */}
        <div className="space-y-6">
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>{tagDraft.id ? "Edit Tag" : "Tag Baru"}</FormCardTitle>
              <FormCardDescription>Gunakan tag untuk melacak dimensi spesifik seperti proyek atau lokasi.</FormCardDescription>
            </FormCardHeader>
            <FormCardContent>
              <form onSubmit={onTagSubmit} className="space-y-4">
                <FormField label="Nama Tag">
                  <TextField
                    placeholder="misal: Proyek Q3, Cabang Jakarta"
                    value={tagDraft.name}
                    onChange={(e) => setTagDraft({ ...tagDraft, name: e.target.value })}
                    required
                  />
                </FormField>

                <FormField label="Warna Tag">
                  <div className="flex flex-wrap gap-3 mt-1">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setTagDraft({ ...tagDraft, color: color.value })}
                        className={`w-8 h-8 rounded-full shadow-sm border-2 transition-all duration-200 ${
                          tagDraft.color === color.value
                            ? "border-gray-900 scale-110"
                            : "border-transparent hover:scale-105 hover:shadow-md"
                        }`}
                        style={{ backgroundColor: color.value }}
                        aria-label={`Pilih warna ${color.label}`}
                        title={color.label}
                      />
                    ))}
                    <div className="relative flex items-center">
                      <input
                        type="color"
                        value={tagDraft.color}
                        onChange={(e) => setTagDraft({ ...tagDraft, color: e.target.value })}
                        className="w-8 h-8 p-0 border-0 rounded-full cursor-pointer overflow-hidden opacity-0 absolute inset-0 z-10"
                      />
                      <div
                        className="w-8 h-8 rounded-full shadow-sm border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50"
                        style={{
                          backgroundColor: PRESET_COLORS.some((c) => c.value === tagDraft.color)
                            ? undefined
                            : tagDraft.color,
                          borderColor: PRESET_COLORS.some((c) => c.value === tagDraft.color)
                            ? undefined
                            : "transparent",
                        }}
                      >
                        {PRESET_COLORS.some((c) => c.value === tagDraft.color) && (
                          <span className="text-gray-600 text-xs">+</span>
                        )}
                      </div>
                    </div>
                  </div>
                </FormField>

                <div className="pt-2 flex justify-end space-x-3">
                  {tagDraft.id && (
                    <button
                      type="button"
                      onClick={() => setTagDraft({ name: "", color: PRESET_COLORS[0].value })}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      Batal
                    </button>
                  )}
                  <SubmitAction
                    isSubmitting={submitBusy === "tag"}
                    label={tagDraft.id ? "Perbarui Tag" : "Tambah Tag"}
                    busyLabel="Menyimpan..."
                  />
                </div>
              </form>
            </FormCardContent>
          </FormCard>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100">
              <h3 className="text-lg font-medium text-gray-900">Semua Tag</h3>
            </div>
            <div>
              {tags.length === 0 ? (
                <EmptyState title="Belum Ada Tag" description="Buat tag pertama Anda di atas." />
              ) : (
                tags.map((tag) => (
                  <div key={tag.id} className="flex items-center justify-between p-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0">
                    <div className="flex items-center space-x-3">
                      <span className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: tag.color || "#4F46E5" }} />
                      <span className="font-medium text-gray-800">{tag.name}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => setTagDraft({ id: tag.id, name: tag.name, color: tag.color || "" })}
                        className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTag(tag.id)}
                        disabled={deleteBusy === "tag"}
                        className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors disabled:opacity-50"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
