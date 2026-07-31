"use client";

import { useEffect, useState } from "react";
import { PlanningView } from "@/components/dashboard/views/PlanningView";
import { emptyGoal, emptyFund } from "@/components/dashboard/model";
import { api, type SavingGoal, type SinkingFund, type Wallet } from "@/lib/api";

export default function PlanningPage() {
  const [goals, setGoals] = useState<SavingGoal[]>([]);
  const [funds, setFunds] = useState<SinkingFund[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [goalDraft, setGoalDraft] = useState(emptyGoal);
  const [fundDraft, setFundDraft] = useState(emptyFund);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  function loadData() {
    setBusy(true);
    Promise.all([api.savingGoals(), api.sinkingFunds(), api.wallets()])
      .then(([g, f, w]) => {
        setGoals(g);
        setFunds(f);
        setWallets(w);
      })
      .catch(console.error)
      .finally(() => setBusy(false));
  }

  async function handleGoalSubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      if (goalDraft.id) {
        await api.patchSavingGoal(goalDraft.id, {
          name: goalDraft.name,
          target_amount: parseFloat(goalDraft.target_amount) || 0,
          target_date: goalDraft.target_date || null,
        });
      } else {
        await api.createSavingGoal({
          name: goalDraft.name,
          target_amount: parseFloat(goalDraft.target_amount) || 0,
          target_date: goalDraft.target_date || null,
        });
      }
      setGoalDraft(emptyGoal);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleFundSubmit(e: any) {
    e.preventDefault();
    setBusy(true);
    try {
      if (fundDraft.id) {
        await api.patchSinkingFund(fundDraft.id, {
          name: fundDraft.name,
          target_amount: parseFloat(fundDraft.target_amount) || 0,
          target_date: fundDraft.target_date || null,
        });
      } else {
        await api.createSinkingFund({
          name: fundDraft.name,
          target_amount: parseFloat(fundDraft.target_amount) || 0,
          target_date: fundDraft.target_date || null,
        });
      }
      setFundDraft(emptyFund);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 bg-[#FBF9F5] min-h-screen">
      <PlanningView
        goals={goals}
        funds={funds}
        wallets={wallets}
        goalDraft={goalDraft}
        setGoalDraft={setGoalDraft}
        fundDraft={fundDraft}
        setFundDraft={setFundDraft}
        onGoalSubmit={handleGoalSubmit}
        onEditGoal={(g) =>
          setGoalDraft({
            id: g.id,
            wallet_id: g.wallet_id || "",
            name: g.name,
            target_amount: String(g.target_amount),
            current_amount: String(g.current_amount || 0),
            currency: g.currency || "IDR",
            target_date: g.target_date || "",
            status: g.status || "active",
            note: g.note || "",
          })
        }
        onDeleteGoal={(id) => api.deleteSavingGoal(id).then(loadData)}
        onFundSubmit={handleFundSubmit}
        onEditFund={(f) =>
          setFundDraft({
            id: f.id,
            saving_goal_id: f.saving_goal_id || "",
            wallet_id: f.wallet_id || "",
            name: f.name,
            target_amount: String(f.target_amount),
            current_amount: String(f.current_amount || 0),
            monthly_target: String(f.monthly_target || 0),
            currency: f.currency || "IDR",
            target_date: f.target_date || "",
            status: f.status || "active",
          })
        }
        onDeleteFund={(id) => api.deleteSinkingFund(id).then(loadData)}
      />
    </div>
  );
}
