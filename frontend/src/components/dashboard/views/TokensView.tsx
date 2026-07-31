import type { FormEvent } from "react";
import type { APIKey, WebhookToken } from "@/lib/api";
import { dateLabel } from "../formatters";
import { DataList, Panel, TextInput } from "@/components/ui/dashboard";

export function TokensView({
  apiKeys,
  webhookTokens,
  apiKeyName,
  webhookTokenName,
  lastSecret,
  setAPIKeyName,
  setWebhookTokenName,
  onAPIKeySubmit,
  onWebhookTokenSubmit,
  onRevokeAPIKey,
  onRevokeWebhookToken,
}: {
  apiKeys: APIKey[];
  webhookTokens: WebhookToken[];
  apiKeyName: string;
  webhookTokenName: string;
  lastSecret: string;
  setAPIKeyName: (value: string) => void;
  setWebhookTokenName: (value: string) => void;
  onAPIKeySubmit: (event: FormEvent) => void;
  onWebhookTokenSubmit: (event: FormEvent) => void;
  onRevokeAPIKey: (id: string) => void;
  onRevokeWebhookToken: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {lastSecret ? (
        <div className="xl:col-span-2 rounded-lg border border-[#10F5CC]/20 bg-[#202A2D] p-4">
          <p className="eyebrow text-[#10F5CC]">New secret</p>
          <p className="mt-2 break-all font-mono text-sm text-[#F5FEFD]/88">{lastSecret}</p>
        </div>
      ) : null}

      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">API keys</p>
            <h3 className="section-title">{apiKeys.length} keys</h3>
          </div>
        </div>
        <form className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={onAPIKeySubmit}>
          <TextInput label="Name" value={apiKeyName} onChange={setAPIKeyName} required />
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Create</button>
          </div>
        </form>
        <DataList
          rows={apiKeys.map((key) => ({
            id: key.id,
            title: `${key.name} - ${key.key_prefix}`,
            meta: `created ${dateLabel(key.created_at)} - last used ${key.last_used_at ? dateLabel(key.last_used_at) : "never"}`,
            action: <button className="link-button danger-text" onClick={() => onRevokeAPIKey(key.id)}>Revoke</button>,
          }))}
        />
      </Panel>

      <Panel>
        <div className="panel-head">
          <div>
            <p className="eyebrow">Webhook tokens</p>
            <h3 className="section-title">{webhookTokens.length} tokens</h3>
          </div>
        </div>
        <form className="mb-4 grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={onWebhookTokenSubmit}>
          <TextInput label="Name" value={webhookTokenName} onChange={setWebhookTokenName} required />
          <div className="flex items-end">
            <button className="btn-primary w-full" type="submit">Create</button>
          </div>
        </form>
        <DataList
          rows={webhookTokens.map((token) => ({
            id: token.id,
            title: `${token.name} - ${token.token_prefix}`,
            meta: `${token.source} - last used ${token.last_used_at ? dateLabel(token.last_used_at) : "never"}`,
            action: <button className="link-button danger-text" onClick={() => onRevokeWebhookToken(token.id)}>Revoke</button>,
          }))}
        />
      </Panel>
    </div>
  );
}
