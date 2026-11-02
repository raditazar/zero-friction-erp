"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";

const HINTS: Partial<Record<PushState, string>> = {
  unsupported: "Peramban ini tidak mendukung notifikasi push.",
  "needs-install": "Di iPhone, notifikasi hanya tersedia setelah aplikasi dipasang: ketuk Bagikan lalu Tambahkan ke Layar Utama, kemudian buka dari ikon tersebut.",
  denied: "Izin notifikasi diblokir. Aktifkan lagi lewat pengaturan situs atau pengaturan aplikasi di ponsel.",
  disabled: "Server belum memiliki kunci VAPID. Setel VAPID_PUBLIC_KEY dan VAPID_PRIVATE_KEY di backend.",
};

export function PushNotificationCard({ id }: { id?: string }) {
  const [state, setState] = useState<PushState | "loading">("loading");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function toggle() {
    setBusy(true);
    try {
      const next = state === "on" ? await disablePush() : await enablePush();
      setState(next);
      if (next === "on") toast.success("Notifikasi push aktif di perangkat ini.");
      else if (next === "off" && state === "on") toast.success("Notifikasi push dimatikan di perangkat ini.");
      else if (next === "denied") toast.error("Izin notifikasi ditolak.");
    } catch (err) {
      toast.error("Gagal mengubah notifikasi push", { detail: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  }

  const hint = state === "loading" ? undefined : HINTS[state];
  const canToggle = state === "on" || state === "off";

  return (
    <section id={id} className="rounded-2xl border border-[#E8E6E1] bg-white p-4 sm:p-5" aria-labelledby={`${id ?? "push"}-title`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F3EE] text-[#1A1A1A]">
          <BellRing className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 id={`${id ?? "push"}-title`} className="text-sm font-bold text-[#1A1A1A]">Notifikasi Push Kotak Masuk</h3>
          <p className="mt-1 text-xs text-[#5A5A5A]">
            Terima pemberitahuan di layar ponsel saat transaksi baru masuk, lalu ketuk untuk langsung membuka dan menyetujuinya.
          </p>
          {hint ? <p className="mt-2 text-xs text-[#7A5B16]">{hint}</p> : null}
        </div>
        <Button
          type="button"
          size="sm"
          variant={state === "on" ? "outline" : "default"}
          disabled={!canToggle || busy}
          onClick={() => void toggle()}
          aria-pressed={state === "on"}
        >
          {busy ? "Memproses..." : state === "on" ? "Matikan" : "Aktifkan"}
        </Button>
      </div>
    </section>
  );
}
