"use client";

import { useEffect, useState } from "react";
import { RecurringView } from "@/components/dashboard/views/RecurringView";
import { emptyRecurringRule } from "@/components/dashboard/model";
import { api, type Category, type RecurringRule, type Wallet } from "@/lib/api";

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState(emptyRecurringRule);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.recurringRules(), api.wallets(), api.categories()])
      .then(([r, w, c]) => {
        setRules(r);
        setWallets(w);
        setCategories(c);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleSubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      if (draft.id) {
        await api.patchRecurringRule(draft.id, {
          name: draft.name,
          cron_expression: draft.cron_expression,
          type: draft.type,
          amount: parseFloat(draft.amount) || 0,
          wallet_id: draft.wallet_id,
          category_id: draft.category_id || null,
        });
      } else {
        await api.createRecurringRule({
          name: draft.name,
          cron_expression: draft.cron_expression || "0 0 1 * *",
          type: draft.type,
          amount: parseFloat(draft.amount) || 0,
          wallet_id: draft.wallet_id,
          category_id: draft.category_id || null,
        });
      }
      setDraft(emptyRecurringRule);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 bg-[#FBF9F5] min-h-screen">
      <RecurringView
        rules={rules}
        wallets={wallets}
        categories={categories}
        draft={draft}
        setDraft={setDraft}
        onSubmit={handleSubmit}
        onEdit={(rule) =>
          setDraft({
            id: rule.id,
            name: rule.name,
            cron_expression: rule.cron_expression || "0 0 1 * *",
            type: rule.type,
            amount: String(rule.amount),
            currency: rule.currency || "IDR",
            wallet_id: rule.wallet_id,
            destination_wallet_id: rule.destination_wallet_id || "",
            category_id: rule.category_id || "",
            merchant: rule.merchant || "",
            interval: "monthly",
            day_of_month: "1",
            weekday: "1",
            time: "00:00",
            status: rule.status || "active",
            note: rule.note || "",
          })
        }
        onDelete={(id) => api.deleteRecurringRule(id).then(loadData)}
        onRunDue={() => api.runRecurring().then(loadData)}
      />
    </div>
  );
}
