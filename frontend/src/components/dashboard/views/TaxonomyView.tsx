import type { FormEvent } from "react";
import type { Category, Tag, TransactionType } from "@/lib/api";
import type { DraftCategory, DraftTag } from "../model";
import { transactionTypes } from "../model";
import { DataList, Panel, SelectField } from "@/components/ui/dashboard";

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
}: {
  categories: Category[];
  tags: Tag[];
  categoryDraft: DraftCategory;
  tagDraft: DraftTag;
  setCategoryDraft: (draft: DraftCategory) => void;
  setTagDraft: (draft: DraftTag) => void;
  onCategorySubmit: (event: FormEvent) => void;
  onTagSubmit: (event: FormEvent) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteTag: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel>
        <div className="panel-head">
          <h3 className="section-title">Categories</h3>
          <span className="text-sm text-zinc-500">{categories.length}</span>
        </div>
        <form className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_120px]" onSubmit={onCategorySubmit}>
          <input className="field" value={categoryDraft.name} onChange={(e) => setCategoryDraft({ ...categoryDraft, name: e.target.value })} placeholder="Category name" required />
          <SelectField value={categoryDraft.type} onValueChange={(type) => setCategoryDraft({ ...categoryDraft, type: type as TransactionType })} options={transactionTypes} />
          <button className="btn-primary" type="submit">Save</button>
        </form>
        <DataList
          rows={categories.map((category) => ({
            id: category.id,
            title: category.name,
            meta: category.type,
            action: (
              <>
                <button className="link-button" onClick={() => setCategoryDraft({ id: category.id, name: category.name, type: category.type, parent_id: category.parent_id ?? "" })}>Edit</button>
                <button className="link-button danger-text" onClick={() => onDeleteCategory(category.id)}>Delete</button>
              </>
            ),
          }))}
        />
      </Panel>
      <Panel>
        <div className="panel-head">
          <h3 className="section-title">Tags</h3>
          <span className="text-sm text-zinc-500">{tags.length}</span>
        </div>
        <form className="mb-4 grid gap-2 md:grid-cols-[1fr_120px_120px]" onSubmit={onTagSubmit}>
          <input className="field" value={tagDraft.name} onChange={(e) => setTagDraft({ ...tagDraft, name: e.target.value })} placeholder="Tag name" required />
          <input className="field" value={tagDraft.color} onChange={(e) => setTagDraft({ ...tagDraft, color: e.target.value })} />
          <button className="btn-primary" type="submit">Save</button>
        </form>
        <DataList
          rows={tags.map((tag) => ({
            id: tag.id,
            title: tag.name,
            meta: tag.color ?? "no color",
            action: (
              <>
                <button className="link-button" onClick={() => setTagDraft({ id: tag.id, name: tag.name, color: tag.color ?? "#22d3ee" })}>Edit</button>
                <button className="link-button danger-text" onClick={() => onDeleteTag(tag.id)}>Delete</button>
              </>
            ),
          }))}
        />
      </Panel>
    </div>
  );
}
