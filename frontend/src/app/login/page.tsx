"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { LoginScreen } from "@/components/dashboard/LoginScreen";

export default function LoginPage() {
  const router = useRouter();
  const [ready, setReady] = useState<{ status: string; database?: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const readyData = await api.ready();
      setReady(readyData);

      try {
        await api.me();
        
        // Ensure workspace is initialized before redirecting
        const [wallets, categories] = await Promise.all([
          api.wallets(),
          api.categories(),
        ]);
        if (wallets.length === 0 || categories.length === 0) {
          await api.setupStarterWorkspace();
        }

        // If successful, user is already logged in
        router.replace("/");
        return;
      } catch (err) {
        setAuthChecked(true);
        setAuthError(err instanceof Error ? err.message : "Please sign in to continue");
      }
    } catch (err) {
      setAuthChecked(true);
      setAuthError(err instanceof Error ? err.message : "Failed to connect to backend");
    }
  }

  return (
    <LoginScreen
      ready={ready}
      authChecked={authChecked}
      authError={authError}
      onRetry={checkAuth}
    />
  );
}
