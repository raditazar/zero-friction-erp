"use client";

import { useEffect, useState, type ReactNode } from "react";
import { SessionNavBar } from "@/components/ui/sidebar";
import { api, type Me } from "@/lib/api";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [readyStatus, setReadyStatus] = useState("ok");

  useEffect(() => {
    api.me().then(setMe).catch(console.error);
    api.ready().then((h) => setReadyStatus(h.status)).catch(() => setReadyStatus("unavailable"));
  }, []);

  return (
    <div className="flex min-h-screen bg-[#FBF9F5]">
      <SessionNavBar
        profileName={me?.profile?.full_name || me?.email || "Finance Manager"}
        profileEmail={me?.email || "user@workspace.local"}
        readyStatus={readyStatus}
      />
      <main className="flex-1 pl-[3.25rem] transition-all duration-200">
        {children}
      </main>
    </div>
  );
}
