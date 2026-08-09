"use client";

import React, { useState } from "react";
import { Panel, DataList, Fact } from "@/components/ui/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialogs/confirm-dialog";


export default function AutomationPage() {
  const [dlqItems, setDlqItems] = useState([
    { id: "1", title: "Sync Customer to CRM", meta: "Failed 3 times. Last error: Timeout." },
    { id: "2", title: "Send Invoice Email", meta: "Failed 5 times. Last error: SMTP Auth." },
  ]);
  
  const [selectedDlq, setSelectedDlq] = useState<string | null>(null);

  const handleIgnore = (id: string) => {
    setDlqItems(prev => prev.filter(item => item.id !== id));
    setSelectedDlq(null);
  };

  const handleRetry = (id: string) => {
    // Simulate retry
    setDlqItems(prev => prev.filter(item => item.id !== id));
  };

  const handleResolve = (id: string) => {
    // Simulate resolve
    setDlqItems(prev => prev.filter(item => item.id !== id));
  };

  const webhookEvents = [
    {
      id: "w1",
      title: <div className="flex items-center gap-2">Order Created <Badge variant="success">Success</Badge></div>,
      meta: "Payload: { orderId: 'ORD-001' } • 2 mins ago"
    },
    {
      id: "w2",
      title: <div className="flex items-center gap-2">Payment Received <Badge variant="warning">Pending</Badge></div>,
      meta: "Retrying in 5 mins • 10 mins ago"
    },
    {
      id: "w3",
      title: <div className="flex items-center gap-2">Inventory Sync <Badge variant="danger">Failed</Badge></div>,
      meta: "Connection refused • 1 hour ago"
    }
  ];

  const dlqRows = dlqItems.map(item => ({
    id: item.id,
    title: item.title,
    meta: item.meta,
    action: (
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setSelectedDlq(item.id)}>Ignore</Button>
        <Button variant="outline" size="sm" onClick={() => handleResolve(item.id)}>Resolve</Button>
        <Button size="sm" onClick={() => handleRetry(item.id)}>Retry</Button>
      </div>
    )
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">System Operations Hub</h1>
        <p className="text-sm text-[#6E6D7A]">Telemetri Webhook & Dead-Letter Queue.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Fact label="Total Event" value="1,245" />
        <Fact label="Gagal" value="23" />
        <Fact label="DLQ" value={dlqItems.length.toString()} />
        <Fact label="Success Rate" value="98.1%" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">Webhook Events</h2>
            <p className="text-sm text-[#6E6D7A]">Aktivitas webhook terbaru</p>
          </div>
          <DataList rows={webhookEvents} />
        </Panel>

        <Panel>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[#1A1A1A]">Dead Letter Queue (DLQ)</h2>
            <p className="text-sm text-[#6E6D7A]">Pesan yang gagal diproses setelah beberapa kali percobaan</p>
          </div>
          <DataList rows={dlqRows} />
        </Panel>
      </div>

      <ConfirmDialog
        open={!!selectedDlq}
        onOpenChange={(open) => !open && setSelectedDlq(null)}
        title="Ignore Message?"
        description="Pesan ini akan dihapus dari DLQ secara permanen dan tidak akan diproses kembali."
        variant="danger"
        confirmLabel="Ignore"
        onConfirm={() => {
          if (selectedDlq) handleIgnore(selectedDlq);
        }}
      />
    </div>
  );
}
