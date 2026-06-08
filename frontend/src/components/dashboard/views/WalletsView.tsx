import type { FormEvent } from "react";
import type { Wallet, WalletBalance } from "@/lib/api";
import type { DraftWallet } from "../model";
import { walletCategories } from "../model";
import { amount } from "../formatters";
import { CurrencyInput, Panel, SelectField, TextInput } from "@/components/ui/dashboard";

export function WalletsView({
  wallets,
  balances,
  draft,
  setDraft,
  onSubmit,
  onEdit,
  onDelete,
}: {
  wallets: Wallet[];
  balances: Record<string, WalletBalance>;
  draft: DraftWallet;
  setDraft: (draft: DraftWallet) => void;
  onSubmit: (event: FormEvent) => void;
  onEdit: (wallet: Wallet) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Wallet balances</p>
            <h3 className="section-title">{wallets.length} accounts</h3>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {wallets.map((wallet) => (
            <div key={wallet.id} className="rounded border border-zinc-800 bg-zinc-950/60 p-4">
              <p className="text-sm font-medium">{wallet.name}</p>
              <p className="mt-1 text-xs text-zinc-500">{wallet.category} - {wallet.provider ?? "no provider"}</p>
              <p className="mt-4 text-2xl font-semibold text-cyan-100">
                {amount(balances[wallet.id]?.curr_balance ?? wallet.init_balance)}
              </p>
              <div className="mt-4 flex gap-2">
                <button className="btn-compact" onClick={() => onEdit(wallet)}>
                  Edit
                </button>
                <button className="btn-compact danger-text" onClick={() => onDelete(wallet.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h3 className="section-title">{draft.id ? "Edit wallet" : "New wallet"}</h3>
        <form className="mt-4 grid gap-3" onSubmit={onSubmit}>
          <TextInput label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} required />
          <SelectField
            value={draft.category}
            onValueChange={(category) => setDraft({ ...draft, category })}
            options={walletCategories}
          />
          <TextInput label="Provider" value={draft.provider} onChange={(provider) => setDraft({ ...draft, provider })} />
          <TextInput
            label="Account number"
            value={draft.account_number}
            onChange={(account_number) => setDraft({ ...draft, account_number })}
          />
          <TextInput label="Currency" value={draft.currency} onChange={(currency) => setDraft({ ...draft, currency })} />
          <CurrencyInput
            label="Initial balance"
            value={draft.init_balance}
            onChange={(init_balance) => setDraft({ ...draft, init_balance })}
          />
          <button className="btn-primary" type="submit">
            Save wallet
          </button>
        </form>
      </Panel>
    </div>
  );
}
