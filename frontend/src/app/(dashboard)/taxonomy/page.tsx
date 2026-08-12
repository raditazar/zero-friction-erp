"use client";

import { useCallback, useEffect, useState } from "react";
import { TaxonomyView } from "@/components/dashboard/views/TaxonomyView";
import { emptyCategory, emptyTag } from "@/components/dashboard/model";
import { api, type Category, type Tag } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { toast } from "@/components/ui/toast";

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function TaxonomyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categoryDraft, setCategoryDraft] = useState(emptyCategory);
  const [tagDraft, setTagDraft] = useState(emptyTag);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submitBusy, setSubmitBusy] = useState<"category" | "tag" | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState<"category" | "tag" | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteCategoryId, setDeleteCategoryId] = useState<string | null>(null);
  const [deleteTagId, setDeleteTagId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [categoryData, tagData] = await Promise.all([api.categories(), api.tags()]);
      setCategories(categoryData);
      setTags(tagData);
    } catch (error) {
      setLoadError(errorMessage(error, "Data taksonomi belum dapat dimuat."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleCategorySubmit() {
    setSubmitBusy("category");
    setSubmitError("");
    const isEditing = Boolean(categoryDraft.id);
    try {
      const payload = { name: categoryDraft.name.trim(), type: categoryDraft.type, parent_id: categoryDraft.parent_id || null };
      if (categoryDraft.id) await api.patchCategory(categoryDraft.id, payload);
      else await api.createCategory(payload);
      toast.success(isEditing ? "Kategori berhasil diperbarui." : "Kategori berhasil ditambahkan.");
      setCategoryDraft(emptyCategory);
      await loadData();
    } catch (error) {
      const msg = errorMessage(error, "Kategori gagal disimpan.");
      setSubmitError(msg);
      toast.error("Gagal menyimpan kategori", { detail: msg });
    } finally {
      setSubmitBusy(null);
    }
  }

  async function handleTagSubmit() {
    setSubmitBusy("tag");
    setSubmitError("");
    const isEditing = Boolean(tagDraft.id);
    try {
      const payload = { name: tagDraft.name.trim(), color: tagDraft.color || null };
      if (tagDraft.id) await api.patchTag(tagDraft.id, payload);
      else await api.createTag(payload);
      toast.success(isEditing ? "Tag berhasil diperbarui." : "Tag berhasil ditambahkan.");
      setTagDraft(emptyTag);
      await loadData();
    } catch (error) {
      const msg = errorMessage(error, "Tag gagal disimpan.");
      setSubmitError(msg);
      toast.error("Gagal menyimpan tag", { detail: msg });
    } finally {
      setSubmitBusy(null);
    }
  }

  function onRequestDeleteCategory(id: string) {
    setDeleteCategoryId(id);
  }

  async function confirmDeleteCategory() {
    if (!deleteCategoryId) return;
    setDeleteBusy("category");
    setDeleteError("");
    try {
      await api.deleteCategory(deleteCategoryId);
      toast.success("Kategori berhasil dihapus.");
      await loadData();
    } catch (error) {
      const msg = errorMessage(error, "Kategori gagal dihapus.");
      setDeleteError(msg);
      toast.error("Gagal menghapus kategori", { detail: msg });
    } finally {
      setDeleteBusy(null);
      setDeleteCategoryId(null);
    }
  }

  function onRequestDeleteTag(id: string) {
    setDeleteTagId(id);
  }

  async function confirmDeleteTag() {
    if (!deleteTagId) return;
    setDeleteBusy("tag");
    setDeleteError("");
    try {
      await api.deleteTag(deleteTagId);
      toast.success("Tag berhasil dihapus.");
      await loadData();
    } catch (error) {
      const msg = errorMessage(error, "Tag gagal dihapus.");
      setDeleteError(msg);
      toast.error("Gagal menghapus tag", { detail: msg });
    } finally {
      setDeleteBusy(null);
      setDeleteTagId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F3EE] p-6">
      <MobilePageHeader />
      <TaxonomyView
        categories={categories}
        tags={tags}
        categoryDraft={categoryDraft}
        tagDraft={tagDraft}
        setCategoryDraft={setCategoryDraft}
        setTagDraft={setTagDraft}
        onCategorySubmit={handleCategorySubmit}
        onTagSubmit={handleTagSubmit}
        onDeleteCategory={onRequestDeleteCategory}
        onDeleteTag={onRequestDeleteTag}
        loading={loading}
        loadError={loadError}
        onRetry={loadData}
        submitBusy={submitBusy}
        submitError={submitError}
        deleteBusy={deleteBusy}
        deleteError={deleteError}
      />

      <ConfirmDialog
        open={!!deleteCategoryId}
        onOpenChange={(open) => !open && setDeleteCategoryId(null)}
        title="Hapus Kategori?"
        description="Apakah Anda yakin ingin menghapus kategori ini? Sub-kategori atau transaksi terkait mungkin perlu disesuaikan."
        variant="danger"
        onConfirm={confirmDeleteCategory}
        isConfirming={deleteBusy === "category"}
      />

      <ConfirmDialog
        open={!!deleteTagId}
        onOpenChange={(open) => !open && setDeleteTagId(null)}
        title="Hapus Tag?"
        description="Apakah Anda yakin ingin menghapus tag ini? Tag akan dihapus dari transaksi terkait."
        variant="danger"
        onConfirm={confirmDeleteTag}
        isConfirming={deleteBusy === "tag"}
      />
    </div>
  );
}
