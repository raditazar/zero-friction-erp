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
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="rounded-xl border border-[#E8E6E1] bg-white p-8 max-w-md shadow-sm">
        <h2 className="text-xl font-bold text-[#1A1A1A] mb-2">Terjadi Kesalahan Halaman</h2>
        <p className="text-sm text-[#6E6D7A] mb-6">
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
