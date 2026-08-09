"use client";

import { useEffect, useState } from "react";
import { RecurringView } from "@/components/dashboard/views/RecurringView";
import { emptyRecurringRule } from "@/components/dashboard/model";
import { api, type Category, type RecurringRule, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ReviewDialog, type ReviewItem } from "@/components/ui/dialogs/review-dialog";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RecurringPage() {
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [draft, setDraft] = useState(emptyRecurringRule);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review Dialog state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [isConfirmingRun, setIsConfirmingRun] = useState(false);
  const [runSubmitError, setRunSubmitError] = useState("");

  // Delete Dialog state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    Promise.all([api.recurringRules(), api.wallets(), api.categories()])
      .then(([r, w, c]) => {
        setRules(r);
        setWallets(w);
        setCategories(c);
      })
      .catch(console.error);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let cron = draft.cron_expression;
      if (!cron) {
        if (draft.interval === "daily") {
           const [hour, minute] = draft.time.split(":");
           cron = `${minute || 0} ${hour || 0} * * *`;
        } else if (draft.interval === "weekly") {
           const [hour, minute] = draft.time.split(":");
           cron = `${minute || 0} ${hour || 0} * * ${draft.weekday}`;
        } else {
           const [hour, minute] = draft.time.split(":");
           cron = `${minute || 0} ${hour || 0} ${draft.day_of_month || 1} * *`;
        }
      }

      if (draft.id) {
        await api.patchRecurringRule(draft.id, {
          name: draft.name,
          cron_expression: cron,
          type: draft.type,
          amount: parseFloat(draft.amount) || 0,
          wallet_id: draft.wallet_id,
          destination_wallet_id: draft.destination_wallet_id || null,
          category_id: draft.category_id || null,
          status: draft.status,
          merchant: draft.merchant,
          note: draft.note,
        });
      } else {
        await api.createRecurringRule({
          name: draft.name,
          cron_expression: cron,
          type: draft.type,
          amount: parseFloat(draft.amount) || 0,
          wallet_id: draft.wallet_id,
          destination_wallet_id: draft.destination_wallet_id || null,
          category_id: draft.category_id || null,
          status: draft.status,
          merchant: draft.merchant,
          note: draft.note,
        });
      }
      setDraft(emptyRecurringRule);
      setIsFormOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePreviewRun() {
    api.previewRunRecurring().then((preview) => {
      setReviewItems(preview.wallet_balances.map(wb => ({
        id: wb.id,
        label: wb.name,
        before: wb.balance_before,
        after: wb.balance_after
      })));
      setIsReviewOpen(true);
    }).catch(console.error);
  }

  function handleConfirmRun() {
    setIsConfirmingRun(true);
    setRunSubmitError("");
    api.runRecurring().then(() => {
      setIsReviewOpen(false);
      loadData();
    }).catch(err => {
      setRunSubmitError(String(err));
    }).finally(() => {
      setIsConfirmingRun(false);
    });
  }

  function handleConfirmDelete() {
    if (!deleteId) return;
    setIsConfirmingDelete(true);
    api.deleteRecurringRule(deleteId).then(() => {
      setDeleteId(null);
      loadData();
    }).catch(console.error)
    .finally(() => {
      setIsConfirmingDelete(false);
    });
  }

  return (
    <div className="p-6 bg-[#F4F3EE] min-h-screen">
      <div className="flex items-center justify-between mb-6">
        <MobilePageHeader />
        <Button onClick={handlePreviewRun} className="flex items-center gap-2">
          <Play className="w-4 h-4" />
          Run Due Rules
        </Button>
      </div>

      <RecurringView
        rules={rules}
        wallets={wallets}
        categories={categories}
        draft={draft}
        setDraft={setDraft}
        onSubmit={handleSubmit}
        onEdit={(rule) => {
          let interval = "monthly";
          let time = "00:00";
          let weekday = "1";
          let day_of_month = "1";

          if (rule.cron_expression) {
            const parts = rule.cron_expression.split(" ");
            if (parts.length === 5) {
              const minute = parts[0].padStart(2, "0");
              const hour = parts[1].padStart(2, "0");
              time = `${hour}:${minute}`;

              if (parts[4] !== "*" && parts[2] === "*") {
                interval = "weekly";
                weekday = parts[4];
              } else if (parts[2] !== "*" && parts[4] === "*") {
                interval = "monthly";
                day_of_month = parts[2];
              } else if (parts[2] === "*" && parts[4] === "*") {
                interval = "daily";
              }
            }
          }

          setDraft({
            id: rule.id,
            name: rule.name,
            cron_expression: rule.cron_expression || "",
            type: rule.type,
            amount: String(rule.amount),
            currency: rule.currency || "IDR",
            wallet_id: rule.wallet_id,
            destination_wallet_id: rule.destination_wallet_id || "",
            category_id: rule.category_id || "",
            merchant: rule.merchant || "",
            interval,
            day_of_month,
            weekday,
            time,
            status: rule.status || "active",
            note: rule.note || "",
          });
          setIsFormOpen(true);
        }}
        onDelete={(id) => setDeleteId(id)}
        isFormOpen={isFormOpen}
        setIsFormOpen={(open) => {
          if (!open) setDraft(emptyRecurringRule);
          setIsFormOpen(open);
        }}
        isSubmitting={isSubmitting}
      />

      <ReviewDialog
        open={isReviewOpen}
        onOpenChange={setIsReviewOpen}
        title="Review Transactions"
        description="Please review the impact on your wallet balances before confirming."
        items={reviewItems}
        requireExplicitConsent={true}
        onConfirm={handleConfirmRun}
        isConfirming={isConfirmingRun}
        submitError={runSubmitError}
        confirmText="Confirm & Run"
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Rule"
        description="Are you sure you want to delete this recurring rule? This action cannot be undone."
        variant="danger"
        onConfirm={handleConfirmDelete}
        isConfirming={isConfirmingDelete}
      />
    </div>
  );
}
