import type { FormEvent } from "react";
import type { SavingGoal, SinkingFund, Wallet } from "@/lib/api";
import type { DraftFund, DraftGoal } from "../model";
import { amount, dateLabel } from "../formatters";
import { CurrencyInput, DataList, Panel, SelectField, TextInput, Textarea } from "@/components/ui/dashboard";

const goalStatuses = ["active", "paused", "completed", "cancelled"];

function progressValue(current: string | number, target: string | number) {
  const targetNumber = Number(target || 0);
  if (targetNumber <= 0) return 0;
  return Math.min(100, Math.round((Number(current || 0) / targetNumber) * 100));
}

export function PlanningView({
  goals,
  funds,
  wallets,
  goalDraft,
  fundDraft,
  setGoalDraft,
  setFundDraft,
  onGoalSubmit,
  onFundSubmit,
  onEditGoal,
  onEditFund,
  onDeleteGoal,
  onDeleteFund,
}: {
  goals: SavingGoal[];
  funds: SinkingFund[];
  wallets: Wallet[];
  goalDraft: DraftGoal;
  fundDraft: DraftFund;
  setGoalDraft: (draft: DraftGoal) => void;
  setFundDraft: (draft: DraftFund) => void;
  onGoalSubmit: (event: FormEvent) => void;
  onFundSubmit: (event: FormEvent) => void;
  onEditGoal: (goal: SavingGoal) => void;
  onEditFund: (fund: SinkingFund) => void;
  onDeleteGoal: (id: string) => void;
  onDeleteFund: (id: string) => void;
}) {
  const walletLabels = Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.name]));
  const goalLabels = Object.fromEntries(goals.map((goal) => [goal.id, goal.name]));

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Saving goals</p>
            <h3 className="section-title">{goals.length} goals</h3>
          </div>
        </div>
        <form className="mb-4 grid gap-3" onSubmit={onGoalSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="Name" value={goalDraft.name} onChange={(name) => setGoalDraft({ ...goalDraft, name })} required />
            <CurrencyInput label="Target amount" value={goalDraft.target_amount} onChange={(target_amount) => setGoalDraft({ ...goalDraft, target_amount })} required />
            <CurrencyInput label="Current amount" value={goalDraft.current_amount} onChange={(current_amount) => setGoalDraft({ ...goalDraft, current_amount })} />
            <TextInput label="Target date" type="date" value={goalDraft.target_date} onChange={(target_date) => setGoalDraft({ ...goalDraft, target_date })} />
            <SelectField value={goalDraft.wallet_id} onValueChange={(wallet_id) => setGoalDraft({ ...goalDraft, wallet_id })} options={wallets.map((wallet) => wallet.id)} labels={walletLabels} placeholder="Wallet" />
            <SelectField value={goalDraft.status} onValueChange={(status) => setGoalDraft({ ...goalDraft, status })} options={goalStatuses} />
          </div>
          <Textarea label="Note" value={goalDraft.note} onChange={(note) => setGoalDraft({ ...goalDraft, note })} />
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">{goalDraft.id ? "Update goal" : "Create goal"}</button>
          </div>
        </form>
        <DataList
          rows={goals.map((goal) => ({
            id: goal.id,
            title: `${goal.name} - ${progressValue(goal.current_amount, goal.target_amount)}%`,
            meta: `${amount(goal.current_amount)} of ${amount(goal.target_amount)} - ${goal.target_date ? dateLabel(goal.target_date) : goal.status}`,
            action: (
              <>
                <button className="link-button" onClick={() => onEditGoal(goal)}>Edit</button>
                <button className="link-button danger-text" onClick={() => onDeleteGoal(goal.id)}>Delete</button>
              </>
            ),
          }))}
        />
      </Panel>

      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Sinking funds</p>
            <h3 className="section-title">{funds.length} funds</h3>
          </div>
        </div>
        <form className="mb-4 grid gap-3" onSubmit={onFundSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <TextInput label="Name" value={fundDraft.name} onChange={(name) => setFundDraft({ ...fundDraft, name })} required />
            <CurrencyInput label="Target amount" value={fundDraft.target_amount} onChange={(target_amount) => setFundDraft({ ...fundDraft, target_amount })} required />
            <CurrencyInput label="Current amount" value={fundDraft.current_amount} onChange={(current_amount) => setFundDraft({ ...fundDraft, current_amount })} />
            <CurrencyInput label="Monthly target" value={fundDraft.monthly_target} onChange={(monthly_target) => setFundDraft({ ...fundDraft, monthly_target })} />
            <TextInput label="Target date" type="date" value={fundDraft.target_date} onChange={(target_date) => setFundDraft({ ...fundDraft, target_date })} />
            <SelectField value={fundDraft.status} onValueChange={(status) => setFundDraft({ ...fundDraft, status })} options={goalStatuses} />
            <SelectField value={fundDraft.wallet_id} onValueChange={(wallet_id) => setFundDraft({ ...fundDraft, wallet_id })} options={wallets.map((wallet) => wallet.id)} labels={walletLabels} placeholder="Wallet" />
            <SelectField value={fundDraft.saving_goal_id} onValueChange={(saving_goal_id) => setFundDraft({ ...fundDraft, saving_goal_id })} options={goals.map((goal) => goal.id)} labels={goalLabels} placeholder="Linked goal" />
          </div>
          <div className="flex justify-end">
            <button className="btn-primary" type="submit">{fundDraft.id ? "Update fund" : "Create fund"}</button>
          </div>
        </form>
        <DataList
          rows={funds.map((fund) => ({
            id: fund.id,
            title: `${fund.name} - ${progressValue(fund.current_amount, fund.target_amount)}%`,
            meta: `${amount(fund.monthly_target)}/month - ${amount(fund.current_amount)} of ${amount(fund.target_amount)}`,
            action: (
              <>
                <button className="link-button" onClick={() => onEditFund(fund)}>Edit</button>
                <button className="link-button danger-text" onClick={() => onDeleteFund(fund.id)}>Delete</button>
              </>
            ),
          }))}
        />
      </Panel>
    </div>
  );
}
