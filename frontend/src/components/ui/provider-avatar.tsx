"use client";

import { useState } from "react";
import Logo from "idn-finlogos/react";
import { getInitials } from "@/lib/provider-catalog";

interface ProviderAvatarProps {
  slug?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

export function ProviderAvatar({
  slug,
  name,
  size = 36,
  className = "",
}: ProviderAvatarProps) {
  const [hasError, setHasError] = useState(false);

  const cleanSlug = slug?.trim() || "";
  const initials = getInitials(name || cleanSlug || "Wallet");

  // Show fallback if no slug or error occurred loading logo
  if (!cleanSlug || hasError) {
    return (
      <div
        style={{ width: size, height: size, fontSize: Math.max(10, Math.floor(size * 0.38)) }}
        className={`inline-flex items-center justify-center rounded-xl bg-[#F0EEE9] border border-[#E8E6E1] font-bold text-[#1A1A1A] shrink-0 select-none shadow-xs ${className}`}
        title={name || "Wallet Provider"}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      style={{ width: size, height: size }}
      className={`inline-flex items-center justify-center rounded-xl bg-white border border-[#E8E6E1] p-1.5 shrink-0 overflow-hidden shadow-xs ${className}`}
    >
      <Logo
        slug={cleanSlug}
        size="100%"
        title={name || cleanSlug}
        onError={() => setHasError(true)}
      />
    </div>
  );
}
