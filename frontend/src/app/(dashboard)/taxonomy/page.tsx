"use client";

import { useCallback, useEffect, useState } from "react";
import { TaxonomyView } from "@/components/dashboard/views/TaxonomyView";
import { emptyCategory, emptyTag } from "@/components/dashboard/model";
import { api, type Category, type Tag } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";

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
    try {
      const payload = { name: categoryDraft.name.trim(), type: categoryDraft.type, parent_id: categoryDraft.parent_id || null };
      if (categoryDraft.id) await api.patchCategory(categoryDraft.id, payload);
      else await api.createCategory(payload);
      setCategoryDraft(emptyCategory);
      await loadData();
    } catch (error) {
      setSubmitError(errorMessage(error, "Kategori gagal disimpan."));
    } finally {
      setSubmitBusy(null);
    }
  }

  async function handleTagSubmit() {
    setSubmitBusy("tag");
    setSubmitError("");
    try {
      const payload = { name: tagDraft.name.trim(), color: tagDraft.color || null };
      if (tagDraft.id) await api.patchTag(tagDraft.id, payload);
      else await api.createTag(payload);
      setTagDraft(emptyTag);
      await loadData();
    } catch (error) {
      setSubmitError(errorMessage(error, "Tag gagal disimpan."));
    } finally {
      setSubmitBusy(null);
    }
  }

  async function deleteCategory(id: string) {
    setDeleteBusy("category");
    setDeleteError("");
    try { await api.deleteCategory(id); await loadData(); }
    catch (error) { setDeleteError(errorMessage(error, "Kategori gagal dihapus.")); throw error; }
    finally { setDeleteBusy(null); }
  }

  async function deleteTag(id: string) {
    setDeleteBusy("tag");
    setDeleteError("");
    try { await api.deleteTag(id); await loadData(); }
    catch (error) { setDeleteError(errorMessage(error, "Tag gagal dihapus.")); throw error; }
    finally { setDeleteBusy(null); }
  }

  return (
    <div className="min-h-screen bg-[#F4F3EE] p-6">
      <MobilePageHeader />
      <TaxonomyView categories={categories} tags={tags} categoryDraft={categoryDraft} tagDraft={tagDraft}
        setCategoryDraft={setCategoryDraft} setTagDraft={setTagDraft} onCategorySubmit={handleCategorySubmit}
        onTagSubmit={handleTagSubmit} onDeleteCategory={deleteCategory} onDeleteTag={deleteTag}
        loading={loading} loadError={loadError} onRetry={loadData} submitBusy={submitBusy} submitError={submitError}
        deleteBusy={deleteBusy} deleteError={deleteError} />
    </div>
  );
}
