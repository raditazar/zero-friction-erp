"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60dvh] p-6 text-center">
      <div className="rounded-xl border border-line bg-card p-8 max-w-md shadow-sm">
        <h2 className="text-xl font-bold text-ink mb-2">Terjadi Kesalahan Halaman</h2>
        <p className="text-sm text-ink-soft mb-6">
          {error.message || "Gagal memuat komponen halaman ini."}
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}
