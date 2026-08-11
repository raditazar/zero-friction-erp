"use client";

import React, { useEffect, useState } from "react";
import { Panel, DataList, Fact } from "@/components/ui/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { api, type DeadLetter, type WebhookEvent } from "@/lib/api";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value: string) => dateFormatter.format(new Date(value));
const badgeVariant = (status: string) => status === "processed" ? "success" : status === "failed" ? "danger" : "warning";

export default function AutomationPage() {
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [selectedDlq, setSelectedDlq] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [events, letters] = await Promise.all([api.webhookEvents(), api.deadLetters()]);
      setWebhookEvents(events);
      setDeadLetters(letters);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Gagal memuat automation.");
    }
  }

  useEffect(() => {
    Promise.all([api.webhookEvents(), api.deadLetters()])
      .then(([events, letters]) => {
        setWebhookEvents(events);
        setDeadLetters(letters);
      })
      .catch((error) => setError(error instanceof Error ? error.message : "Gagal memuat automation."));
  }, []);

  async function updateDlq(id: string, action: "retry" | "resolve" | "ignore") {
    try {
      setBusyId(id);
      setError("");
      await api[`${action}DeadLetter`](id);
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Aksi gagal.");
    } finally {
      setBusyId(null);
      setSelectedDlq(null);
    }
  }

  async function retryWebhook(id: string) {
    try {
      setBusyId(id);
      setError("");
      await api.retryWebhookEvent(id);
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Retry gagal.");
    } finally {
      setBusyId(null);
    }
  }

  const openDeadLetters = deadLetters.filter((item) => item.status === "open");
  const failedEvents = webhookEvents.filter((item) => item.status === "failed").length;
  const processedEvents = webhookEvents.filter((item) => item.status === "processed").length;
  const webhookRows = webhookEvents.map((item) => ({
    id: item.id,
    title: <div className="flex items-center gap-2">{item.source} <Badge variant={badgeVariant(item.status)}>{item.status}</Badge></div>,
    meta: `${item.idempotency_text} · ${formatDate(item.created_at)}`,
    action: item.status === "failed" ? <Button size="sm" disabled={busyId === item.id} onClick={() => void retryWebhook(item.id)}>Retry</Button> : undefined,
  }));
  const dlqRows = openDeadLetters.map((item) => ({
    id: item.id,
    title: item.error_msg,
    meta: `${item.webhook_event_id ?? "Webhook tidak tersedia"} · ${formatDate(item.created_at)}`,
    action: <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => setSelectedDlq(item.id)}>Ignore</Button><Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => void updateDlq(item.id, "resolve")}>Resolve</Button><Button size="sm" disabled={busyId === item.id} onClick={() => void updateDlq(item.id, "retry")}>Retry</Button></div>,
  }));

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">System Operations Hub</h1><p className="text-sm text-[#6E6D7A]">Telemetri Webhook & Dead-Letter Queue.</p></div>
      {error ? <p role="alert" className="rounded-md border border-[#E6C8BE] bg-[#FAE8E3] px-4 py-3 text-sm text-[#7A2E1D]">{error}</p> : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Total Event" value={webhookEvents.length.toString()} /><Fact label="Gagal" value={failedEvents.toString()} /><Fact label="DLQ" value={openDeadLetters.length.toString()} /><Fact label="Success Rate" value={webhookEvents.length ? `${Math.round((processedEvents / webhookEvents.length) * 100)}%` : "—"} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Panel><div className="mb-4"><h2 className="text-lg font-semibold text-[#1A1A1A]">Webhook Events</h2><p className="text-sm text-[#6E6D7A]">Aktivitas webhook terbaru</p></div><DataList rows={webhookRows} /></Panel><Panel><div className="mb-4"><h2 className="text-lg font-semibold text-[#1A1A1A]">Dead Letter Queue (DLQ)</h2><p className="text-sm text-[#6E6D7A]">Pesan gagal diproses</p></div><DataList rows={dlqRows} /></Panel></div>
      <ConfirmDialog open={!!selectedDlq} onOpenChange={(open) => !open && setSelectedDlq(null)} title="Ignore Message?" description="Pesan ini akan diabaikan permanen dan tidak diproses kembali." variant="danger" confirmLabel="Ignore" onConfirm={() => { if (selectedDlq) void updateDlq(selectedDlq, "ignore"); }} />
    </div>
  );
}
