import type { DeadLetter, WebhookEvent } from "@/lib/api";
import { dateLabel, shortID } from "../formatters";
import { DataList, Panel } from "@/components/ui/dashboard";

export function AutomationView({
  events,
  deadLetters,
  onRetryEvent,
  onRetryDeadLetter,
  onResolveDeadLetter,
  onIgnoreDeadLetter,
}: {
  events: WebhookEvent[];
  deadLetters: DeadLetter[];
  onRetryEvent: (id: string) => void;
  onRetryDeadLetter: (id: string) => void;
  onResolveDeadLetter: (id: string) => void;
  onIgnoreDeadLetter: (id: string) => void;
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Panel>
        <div className="panel-head">
          <h3 className="section-title">Webhook events</h3>
          <span className="text-sm text-zinc-500">{events.length}</span>
        </div>
        <DataList
          rows={events.map((event) => ({
            id: event.id,
            title: `${event.source} - ${event.status}`,
            meta: `${shortID(event.idempotency_text)} - ${dateLabel(event.created_at)}`,
            action: <button className="link-button" onClick={() => onRetryEvent(event.id)}>Retry</button>,
          }))}
        />
      </Panel>
      <Panel>
        <div className="panel-head">
          <h3 className="section-title">Dead letter queue</h3>
          <span className="text-sm text-zinc-500">{deadLetters.length}</span>
        </div>
        <DataList
          rows={deadLetters.map((letter) => ({
            id: letter.id,
            title: letter.error_msg,
            meta: `${letter.status} - ${dateLabel(letter.created_at)}`,
            action: (
              <>
                <button className="link-button" onClick={() => onRetryDeadLetter(letter.id)}>Retry</button>
                <button className="link-button" onClick={() => onResolveDeadLetter(letter.id)}>Resolve</button>
                <button className="link-button danger-text" onClick={() => onIgnoreDeadLetter(letter.id)}>Ignore</button>
              </>
            ),
          }))}
        />
      </Panel>
    </div>
  );
}
