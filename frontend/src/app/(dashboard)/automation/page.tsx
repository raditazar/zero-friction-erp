"use client";

import React, { useEffect, useState } from "react";
import { Panel, DataList, Fact } from "@/components/ui/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";
import { api, type DeadLetter, type WebhookEvent } from "@/lib/api";
import { toast } from "@/components/ui/toast";
import { MobilePageHeader } from "@/components/ui/mobile-page-header";
import { ErrorState, LoadingState } from "@/components/ui/feedback";

const dateFormatter = new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" });
const formatDate = (value: string) => dateFormatter.format(new Date(value));
const badgeVariant = (status: string) => status === "processed" ? "success" : status === "failed" ? "danger" : "warning";

export default function AutomationPage() {
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([]);
  const [deadLetters, setDeadLetters] = useState<DeadLetter[]>([]);
  const [selectedDlq, setSelectedDlq] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [events, letters] = await Promise.all([api.webhookEvents(), api.deadLetters()]);
      setWebhookEvents(events);
      setDeadLetters(letters);
      setError("");
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
      .catch((error) => setError(error instanceof Error ? error.message : "Gagal memuat automation."))
      .finally(() => setLoading(false));
  }, []);

  async function updateDlq(id: string, action: "retry" | "resolve" | "ignore") {
    try {
      setBusyId(id);
      setError("");
      await api[`${action}DeadLetter`](id);
      const actionText = action === "retry" ? "dicoba ulang" : action === "resolve" ? "ditandai selesai" : "diabaikan";
      toast.success(`Pesan gagal ${actionText}.`);
      await load();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Aksi gagal.";
      setError(msg);
      toast.error("Pesan gagal belum bisa diproses", { detail: msg });
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
      toast.success("Berhasil mencoba ulang event webhook.");
      await load();
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Belum bisa dicoba ulang.";
      setError(msg);
      toast.error("Gagal mencoba ulang event webhook", { detail: msg });
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
    action: item.status === "failed" ? <Button size="sm" disabled={busyId === item.id} onClick={() => void retryWebhook(item.id)}>Coba lagi</Button> : undefined,
  }));
  const dlqRows = openDeadLetters.map((item) => ({
    id: item.id,
    title: item.error_msg,
    meta: `${item.webhook_event_id ?? "Webhook tidak tersedia"} · ${formatDate(item.created_at)}`,
    action: <div className="flex items-center gap-2"><Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => setSelectedDlq(item.id)}>Abaikan</Button><Button variant="outline" size="sm" disabled={busyId === item.id} onClick={() => void updateDlq(item.id, "resolve")}>Selesai</Button><Button size="sm" disabled={busyId === item.id} onClick={() => void updateDlq(item.id, "retry")}>Coba lagi</Button></div>,
  }));

  return (
    <div className="page-shell">
      <MobilePageHeader />
      <div className="space-y-6">
        <div className="hidden md:block"><h1 className="text-2xl font-bold tracking-tight text-ink">Pusat otomasi</h1><p className="text-sm text-ink-soft">Kejadian dari integrasi dan pesan yang gagal diproses.</p></div>
        {error ? <ErrorState compact title="Data otomasi belum bisa dimuat" message={error} onRetry={() => void load()} /> : null}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Kejadian" value={webhookEvents.length.toString()} /><Fact label="Gagal" value={failedEvents.toString()} /><Fact label="Antrean gagal" value={openDeadLetters.length.toString()} /><Fact label="Berhasil" value={webhookEvents.length ? `${Math.round((processedEvents / webhookEvents.length) * 100)}%` : "—"} /></div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2"><Panel><div className="mb-4"><h2 className="text-lg font-semibold text-ink">Kejadian webhook</h2><p className="text-sm text-ink-soft">Yang masuk dari integrasi, terbaru di atas.</p></div>{loading ? <LoadingState variant="list" rows={3} label="Memuat event webhook" className="[&_.rounded-2xl]:border-0 [&_.rounded-2xl]:px-0" /> : <DataList rows={webhookRows} />}</Panel><Panel><div className="mb-4"><h2 className="text-lg font-semibold text-ink">Antrean gagal</h2><p className="text-sm text-ink-soft">Pesan yang gagal diproses dan menunggu keputusan.</p></div>{loading ? <LoadingState variant="list" rows={3} label="Memuat antrean gagal" className="[&_.rounded-2xl]:border-0 [&_.rounded-2xl]:px-0" /> : <DataList rows={dlqRows} />}</Panel></div>
        <ConfirmDialog open={!!selectedDlq} onOpenChange={(open) => !open && setSelectedDlq(null)} title="Ignore Message?" description="Pesan ini akan diabaikan permanen dan tidak diproses kembali." variant="danger" confirmLabel="Ignore" onConfirm={() => { if (selectedDlq) void updateDlq(selectedDlq, "ignore"); }} />
      </div>
    </div>
  );
}
