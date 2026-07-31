"use client";

import { useEffect, useState } from "react";
import { TaxonomyView } from "@/components/dashboard/views/TaxonomyView";
import { emptyCategory, emptyTag } from "@/components/dashboard/model";
import { api, type Category, type Tag } from "@/lib/api";

export default function TaxonomyPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [categoryDraft, setCategoryDraft] = useState(emptyCategory);
  const [tagDraft, setTagDraft] = useState(emptyTag);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.categories(), api.tags()])
      .then(([catData, tagData]) => {
        setCategories(catData);
        setTags(tagData);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleCategorySubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      if (categoryDraft.id) {
        await api.patchCategory(categoryDraft.id, {
          name: categoryDraft.name,
          type: categoryDraft.type,
          parent_id: categoryDraft.parent_id || null,
        });
      } else {
        await api.createCategory({
          name: categoryDraft.name,
          type: categoryDraft.type,
          parent_id: categoryDraft.parent_id || null,
        });
      }
      setCategoryDraft(emptyCategory);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleTagSubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      if (tagDraft.id) {
        await api.patchTag(tagDraft.id, { name: tagDraft.name, color: tagDraft.color || null });
      } else {
        await api.createTag({ name: tagDraft.name, color: tagDraft.color || null });
      }
      setTagDraft(emptyTag);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 bg-[#FBF9F5] min-h-screen">
      <TaxonomyView
        categories={categories}
        tags={tags}
        categoryDraft={categoryDraft}
        setCategoryDraft={setCategoryDraft}
        tagDraft={tagDraft}
        setTagDraft={setTagDraft}
        onCategorySubmit={handleCategorySubmit}
        onDeleteCategory={(id) => api.deleteCategory(id).then(loadData)}
        onTagSubmit={handleTagSubmit}
        onDeleteTag={(id) => api.deleteTag(id).then(loadData)}
      />
    </div>
  );
}
