"use client";

import React, { useState, useMemo, type FormEvent } from "react";
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
  SearchField,
  SubmitAction,
} from "@/components/ui/form";
import { FormDialog } from "@/components/ui/dialogs/form-dialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { Panel } from "@/components/ui/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoTooltip, InfoTooltipProvider } from "@/components/ui/info-tooltip";

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
  const [activeTab, setActiveTab] = useState<TransactionType>("expense");
  const [categorySearch, setCategorySearch] = useState("");
  const [parentSearch, setParentSearch] = useState("");
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);

  const parentCategoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  // Available parent options for the draft category
  const availableParentOptions = useMemo(() => {
    return categories
      .filter((c) => c.type === categoryDraft.type && !c.parent_id && c.id !== categoryDraft.id)
      .map((c) => ({ label: c.name, value: c.id }));
  }, [categories, categoryDraft.type, categoryDraft.id]);

  // Filtered parent options based on parent search inside modal
  const filteredParentOptions = useMemo(() => {
    if (!parentSearch.trim()) return availableParentOptions;
    const query = parentSearch.toLowerCase();
    return availableParentOptions.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [availableParentOptions, parentSearch]);

  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  );
  const incomeCategories = useMemo(
    () => categories.filter((c) => c.type === "income"),
    [categories]
  );

  const currentTabCategories = activeTab === "expense" ? expenseCategories : incomeCategories;

  // Root categories in current tab
  const rootCategories = useMemo(() => {
    return currentTabCategories.filter(
      (c) => !c.parent_id || !parentCategoryMap.has(c.parent_id)
    );
  }, [currentTabCategories, parentCategoryMap]);

  // Filtered Root categories based on category search
  const filteredRootCategories = useMemo(() => {
    if (!categorySearch.trim()) return rootCategories;
    const q = categorySearch.toLowerCase().trim();

    return rootCategories.filter((rootCat) => {
      const rootMatches = rootCat.name.toLowerCase().includes(q);
      const subMatches = categories.some(
        (sub) => sub.parent_id === rootCat.id && sub.name.toLowerCase().includes(q)
      );
      return rootMatches || subMatches;
    });
  }, [rootCategories, categorySearch, categories]);

  if (loading) return <LoadingState label="Memuat data taksonomi..." />;
  if (loadError) return <ErrorState title="Gagal Memuat Taksonomi" message={loadError} onRetry={onRetry} />;

  function handleOpenCreateRoot() {
    setCategoryDraft({ name: "", type: activeTab, parent_id: "" });
    setParentSearch("");
    setCategoryModalOpen(true);
  }

  function handleOpenCreateSub(rootCat: Category) {
    setCategoryDraft({ name: "", type: rootCat.type, parent_id: rootCat.id });
    setParentSearch("");
    setCategoryModalOpen(true);
  }

  function handleOpenEditCategory(cat: Category) {
    setCategoryDraft({
      id: cat.id,
      name: cat.name,
      type: cat.type,
      parent_id: cat.parent_id || "",
    });
    setParentSearch("");
    setCategoryModalOpen(true);
  }

  async function handleCategoryFormSubmit(e: FormEvent) {
    e.preventDefault();
    await onCategorySubmit(e);
    setCategoryModalOpen(false);
  }

  return (
    <InfoTooltipProvider>
      <div className="space-y-8 animate-in fade-in duration-500">
        {(submitError || deleteError) && (
          <div className="p-4 mb-6 rounded-md bg-red-50 border border-red-200">
            <p className="text-sm text-red-700">{submitError || deleteError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Column: Categories Section */}
          <div className="space-y-4">
            {/* Header & Type Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={activeTab === "expense" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setActiveTab("expense");
                    setCategorySearch("");
                  }}
                  className="text-xs font-semibold"
                >
                  Pengeluaran ({expenseCategories.length})
                </Button>
                <Button
                  type="button"
                  variant={activeTab === "income" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setActiveTab("income");
                    setCategorySearch("");
                  }}
                  className="text-xs font-semibold"
                >
                  Pendapatan ({incomeCategories.length})
                </Button>
              </div>

              <Button
                type="button"
                size="sm"
                onClick={handleOpenCreateRoot}
                className="bg-[#1A1A1A] hover:bg-black text-[#FBF9F5] font-semibold text-xs h-8 px-3"
              >
                + Kategori Baru
              </Button>
            </div>

            {/* Educational Banner */}
            <div className="p-3 bg-[#EAE8E3] rounded-xl text-xs text-[#5A5A5A] flex items-center justify-between gap-2 border border-[#E0DDD6]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#1A1A1A]">Struktur Taksonomi:</span>
                <span>Kategori Induk untuk ringkasan anggaran, Subkategori untuk detail transaksi harian.</span>
              </div>
              <InfoTooltip content="Saat input transaksi, pilih subkategori spesifik. Pengeluaran otomatis memotong anggaran di kategori induk." />
            </div>

            {/* Category Search Filter */}
            <div className="w-full">
              <SearchField
                placeholder={`Cari kategori ${activeTab === "expense" ? "pengeluaran" : "pendapatan"} atau subkategori...`}
                value={categorySearch}
                onChange={(e) => setCategorySearch(e.target.value)}
              />
            </div>

            {/* Hierarchical Categories List */}
            {filteredRootCategories.length === 0 ? (
              <EmptyState
                title={
                  categorySearch.trim()
                    ? "Tidak Ada Kategori Ditemukan"
                    : activeTab === "expense"
                    ? "Belum Ada Kategori Pengeluaran"
                    : "Belum Ada Kategori Pendapatan"
                }
                description={
                  categorySearch.trim()
                    ? `Tidak ada kategori yang cocok dengan "${categorySearch}".`
                    : "Klik '+ Kategori Baru' untuk membuat kategori pertama Anda."
                }
              />
            ) : (
              <div className="space-y-3">
                {filteredRootCategories.map((rootCat) => {
                  const subcategories = categories.filter((c) => c.parent_id === rootCat.id);
                  const searchTrimmed = categorySearch.toLowerCase().trim();
                  const filteredSubcategories = searchTrimmed
                    ? subcategories.filter((sub) => sub.name.toLowerCase().includes(searchTrimmed))
                    : subcategories;

                  return (
                    <Panel
                      key={rootCat.id}
                      className="p-4 rounded-xl border border-[#E8E6E1] bg-white shadow-xs"
                    >
                      {/* Root Category Header Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-[#1A1A1A] text-sm md:text-base truncate">
                            {rootCat.name}
                          </span>
                          <Badge variant="neutral" className="text-[10px] font-mono tracking-wider">
                            Induk
                          </Badge>
                          {subcategories.length > 0 && (
                            <span className="text-xs text-[#756F64] font-medium hidden sm:inline">
                              ({subcategories.length} subkategori)
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="text-xs font-medium h-7 px-2.5"
                            onClick={() => handleOpenCreateSub(rootCat)}
                          >
                            + Subkategori
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 h-7 px-2"
                            onClick={() => handleOpenEditCategory(rootCat)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={deleteBusy === "category"}
                            className="text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 h-7 px-2 disabled:opacity-50"
                            onClick={() => onDeleteCategory(rootCat.id)}
                          >
                            Hapus
                          </Button>
                        </div>
                      </div>

                      {/* Subcategories List */}
                      {subcategories.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100 space-y-1.5">
                          {filteredSubcategories.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between pl-3 pr-2 py-1.5 rounded-lg bg-gray-50/90 hover:bg-gray-100/90 transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-gray-400 font-mono text-sm shrink-0">↳</span>
                                <span className="text-sm font-medium text-[#1A1A1A] truncate">
                                  {sub.name}
                                </span>
                                <Badge variant="secondary" className="text-[9px] py-0 px-1.5 font-normal shrink-0">
                                  Sub
                                </Badge>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 h-6 px-1.5"
                                  onClick={() => handleOpenEditCategory(sub)}
                                >
                                  Edit
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  disabled={deleteBusy === "category"}
                                  className="text-xs font-medium text-red-600 hover:text-red-800 hover:bg-red-50 h-6 px-1.5 disabled:opacity-50"
                                  onClick={() => onDeleteCategory(sub.id)}
                                >
                                  Hapus
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Panel>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Tags Section */}
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
                          className={`w-8 h-8 rounded-full border-2 transition-transform ${
                            tagDraft.color === color.value ? "scale-110 border-gray-900 shadow-sm" : "border-transparent hover:scale-105"
                          }`}
                          style={{ backgroundColor: color.value }}
                          aria-label={`Pilih warna ${color.label}`}
                        />
                      ))}
                    </div>
                  </FormField>

                  <div className="pt-2 flex justify-end space-x-3">
                    {tagDraft.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTagDraft({ name: "", color: "" })}
                      >
                        Batal
                      </Button>
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

            <Panel className="p-5 rounded-xl border border-[#E8E6E1] bg-white shadow-xs">
              <h3 className="text-base font-bold text-[#1A1A1A] mb-3">Daftar Tag ({tags.length})</h3>
              {tags.length === 0 ? (
                <EmptyState title="Belum Ada Tag" description="Buat tag pertama Anda untuk mengelompokkan transaksi." />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: tag.color || "#4F46E5" }}
                      />
                      <span className="font-medium text-gray-800">{tag.name}</span>
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() =>
                            setTagDraft({
                              id: tag.id,
                              name: tag.name,
                              color: tag.color || "",
                            })
                          }
                          className="text-xs text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteTag(tag.id)}
                          disabled={deleteBusy === "tag"}
                          className="text-xs text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </div>

        {/* Modal Dialog: Category Create & Edit */}
        <FormDialog
          open={categoryModalOpen}
          onOpenChange={setCategoryModalOpen}
          title={
            categoryDraft.id
              ? "Edit Kategori"
              : categoryDraft.parent_id
              ? "Tambah Subkategori"
              : "Tambah Kategori Baru"
          }
          description={
            categoryDraft.parent_id
              ? `Subkategori akan berada di bawah induk "${parentCategoryMap.get(categoryDraft.parent_id) || "Induk"}".`
              : "Kategori Induk digunakan sebagai wadah utama alokasi anggaran."
          }
          submitLabel={categoryDraft.id ? "Simpan Perubahan" : "Tambah Kategori"}
          isSubmitting={submitBusy === "category"}
          onSubmit={handleCategoryFormSubmit}
        >
          <div className="space-y-4 py-2">
            <FormField label="Tipe Kategori" htmlFor="modalCategoryType">
              <NativeSelectField
                id="modalCategoryType"
                value={categoryDraft.type}
                onChange={(e) => {
                  const newType = e.target.value as TransactionType;
                  setCategoryDraft({
                    ...categoryDraft,
                    type: newType,
                    parent_id: "",
                  });
                  setActiveTab(newType);
                }}
                disabled={!!categoryDraft.id}
              >
                <option value="expense">Pengeluaran (Expense)</option>
                <option value="income">Pendapatan (Income)</option>
              </NativeSelectField>
            </FormField>

            <FormField label="Nama Kategori" htmlFor="modalCategoryName">
              <TextField
                id="modalCategoryName"
                placeholder="misal: Makanan & Minuman, Kopi, Gaji"
                value={categoryDraft.name}
                onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })}
                required
                autoFocus
              />
            </FormField>

            <FormField label="Kategori Induk (Parent)" htmlFor="modalParentSelect">
              <div className="space-y-2">
                {availableParentOptions.length > 5 && (
                  <SearchField
                    placeholder="Cari kategori induk..."
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                  />
                )}
                <NativeSelectField
                  id="modalParentSelect"
                  value={categoryDraft.parent_id || ""}
                  onChange={(e) => setCategoryDraft({ ...categoryDraft, parent_id: e.target.value })}
                >
                  <option value="">Jadikan Kategori Induk (Tanpa Parent)</option>
                  {filteredParentOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </NativeSelectField>
                {categoryDraft.parent_id && (
                  <p className="text-xs text-gray-500">
                    Kategori ini akan menjadi subkategori di bawah{" "}
                    <strong>{parentCategoryMap.get(categoryDraft.parent_id)}</strong>.
                  </p>
                )}
              </div>
            </FormField>
          </div>
        </FormDialog>
      </div>
    </InfoTooltipProvider>
  );
}
