"use client";

import { useCallback, useEffect, useState } from "react";
import { PlanningView } from "@/components/dashboard/views/PlanningView";
import { emptyGoal, emptyFund } from "@/components/dashboard/model";
import { api, type SavingGoal, type SinkingFund, type Wallet } from "@/lib/api";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { toast } from "@/components/ui/toast";

type DeleteTarget = { type: "goal" | "fund"; id: string; name: string } | null;

function messageFromError(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function PlanningPage() {
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [funds, setFunds] = useState<SinkingFund[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [goalDraft, setGoalDraft] = useState(emptyGoal);
  const [fundDraft, setFundDraft] = useState(emptyFund);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [goalSubmitBusy, setGoalSubmitBusy] = useState(false);
  const [fundSubmitBusy, setFundSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [goalData, fundData, walletData] = await Promise.all([api.savingGoals(), api.sinkingFunds(), api.wallets()]);
      setGoals(goalData);
      setFunds(fundData);
      setWallets(walletData);
    } catch (error) {
      setLoadError(messageFromError(error, "Rencana belum dapat dimuat. Periksa koneksi lalu coba lagi."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [loadData]);

  async function handleGoalSubmit() {
    if (goalSubmitBusy) return;
    setSubmitError("");
    setGoalSubmitBusy(true);
    const isEditing = Boolean(goalDraft.id);
    const payload = {
      wallet_id: goalDraft.wallet_id || null,
      name: goalDraft.name.trim(),
      target_amount: Number(goalDraft.target_amount) || 0,
      current_amount: Number(goalDraft.current_amount) || 0,
      currency: goalDraft.currency || "IDR",
      target_date: goalDraft.target_date || null,
      status: goalDraft.status || "active",
      note: goalDraft.note.trim() || null,
    };
    try {
      if (goalDraft.id) await api.patchSavingGoal(goalDraft.id, payload);
      else await api.createSavingGoal(payload);
      toast.success(isEditing ? "Target tabungan berhasil diperbarui." : "Target tabungan berhasil ditambahkan.");
      setGoalDraft(emptyGoal);
      await loadData();
    } catch (error) {
      const msg = messageFromError(error, "Target belum tersimpan. Periksa data atau koneksi lalu coba lagi.");
      setSubmitError(msg);
      toast.error("Gagal menyimpan target tabungan", { detail: msg });
    } finally {
      setGoalSubmitBusy(false);
    }
  }

  async function handleFundSubmit() {
    if (fundSubmitBusy) return;
    setSubmitError("");
    setFundSubmitBusy(true);
    const isEditing = Boolean(fundDraft.id);
    const payload = {
      saving_goal_id: fundDraft.saving_goal_id || null,
      wallet_id: fundDraft.wallet_id || null,
      name: fundDraft.name.trim(),
      target_amount: Number(fundDraft.target_amount) || 0,
      current_amount: Number(fundDraft.current_amount) || 0,
      monthly_target: Number(fundDraft.monthly_target) || 0,
      currency: fundDraft.currency || "IDR",
      target_date: fundDraft.target_date || null,
      status: fundDraft.status || "active",
    };
    try {
      if (fundDraft.id) await api.patchSinkingFund(fundDraft.id, payload);
      else await api.createSinkingFund(payload);
      toast.success(isEditing ? "Sinking fund berhasil diperbarui." : "Sinking fund berhasil ditambahkan.");
      setFundDraft(emptyFund);
      await loadData();
    } catch (error) {
      const msg = messageFromError(error, "Dana belum tersimpan. Periksa data atau koneksi lalu coba lagi.");
      setSubmitError(msg);
      toast.error("Gagal menyimpan sinking fund", { detail: msg });
    } finally {
      setFundSubmitBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget || deleteBusy) return;
    const isGoal = deleteTarget.type === "goal";
    setDeleteError("");
    setDeleteBusy(true);
    try {
      if (deleteTarget.type === "goal") await api.deleteSavingGoal(deleteTarget.id);
      else await api.deleteSinkingFund(deleteTarget.id);
      toast.success(isGoal ? "Target tabungan berhasil dihapus." : "Sinking fund berhasil dihapus.");
      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      const msg = messageFromError(error, "Item belum dihapus. Periksa koneksi lalu coba lagi.");
      setDeleteError(msg);
      toast.error(isGoal ? "Gagal menghapus target tabungan" : "Gagal menghapus sinking fund", { detail: msg });
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#F4F3EE] p-6">
      <MobilePageHeader />
      <PlanningView
        goals={goals} funds={funds} wallets={wallets}
        goalDraft={goalDraft} fundDraft={fundDraft}
        setGoalDraft={setGoalDraft} setFundDraft={setFundDraft}
        onGoalSubmit={handleGoalSubmit} onFundSubmit={handleFundSubmit}
        onEditGoal={(goal) => { setSubmitError(""); setGoalDraft({ id: goal.id, wallet_id: goal.wallet_id || "", name: goal.name, target_amount: String(goal.target_amount), current_amount: String(goal.current_amount || 0), currency: goal.currency || "IDR", target_date: goal.target_date || "", status: goal.status || "active", note: goal.note || "" }); }}
        onEditFund={(fund) => { setSubmitError(""); setFundDraft({ id: fund.id, saving_goal_id: fund.saving_goal_id || "", wallet_id: fund.wallet_id || "", name: fund.name, target_amount: String(fund.target_amount), current_amount: String(fund.current_amount || 0), monthly_target: String(fund.monthly_target || 0), currency: fund.currency || "IDR", target_date: fund.target_date || "", status: fund.status || "active" }); }}
        onDeleteGoal={(goal) => { setDeleteError(""); setDeleteTarget({ type: "goal", id: goal.id, name: goal.name }); }}
        onDeleteFund={(fund) => { setDeleteError(""); setDeleteTarget({ type: "fund", id: fund.id, name: fund.name }); }}
        loading={loading} loadError={loadError} onRetryLoad={loadData}
        goalSubmitBusy={goalSubmitBusy} fundSubmitBusy={fundSubmitBusy}
        submitError={submitError} deleteError={deleteError}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !deleteBusy && setDeleteTarget(null)}
        title={`Hapus ${deleteTarget?.type === "goal" ? "target" : "dana"} ini?`}
        description={`"${deleteTarget?.name ?? ""}" akan dihapus permanen. Tahan tombol hapus selama 2 detik untuk mengonfirmasi.`}
        variant="danger" confirmLabel="Tahan untuk hapus" isConfirming={deleteBusy} onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
