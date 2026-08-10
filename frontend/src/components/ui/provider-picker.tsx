"use client";

import { useState, useMemo } from "react";
import { PROVIDER_CATALOG, type ProviderItem } from "@/lib/provider-catalog";
import { ProviderAvatar } from "./provider-avatar";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogBody,
} from "./dialog";
import { Search } from "lucide-react";

interface ProviderPickerProps {
  valueSlug?: string;
  valueName?: string;
  onChange: (provider: { slug: string; name: string }) => void;
}

export function ProviderPicker({
  valueSlug,
  valueName,
  onChange,
}: ProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return PROVIDER_CATALOG.filter((item) => {
      const matchCat =
        selectedCategory === "all" || item.category === selectedCategory;
      if (!matchCat) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.aliases?.some((a) => a.toLowerCase().includes(q))
      );
    });
  }, [search, selectedCategory]);

  function handleSelect(item: ProviderItem) {
    onChange({ slug: item.slug, name: item.name });
    setOpen(false);
    setSearch("");
  }

  function handleCustomUse() {
    if (search.trim()) {
      onChange({ slug: "", name: search.trim() });
      setOpen(false);
      setSearch("");
    }
  }

  const selectedItem = PROVIDER_CATALOG.find((p) => p.slug === valueSlug);
  const displayTitle = selectedItem?.name || valueName || "Pilih Penyedia Bank / E-Wallet";

  return (
    <div>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-label="Pilih Bank atau E-Wallet"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 rounded-lg border border-[#E8E6E1] bg-white px-3 py-2 text-left text-sm font-medium text-[#1A1A1A] shadow-xs hover:border-[#38484E] transition-all focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <ProviderAvatar slug={valueSlug} name={displayTitle} size={28} />
          <span className="truncate">{displayTitle}</span>
        </div>
        <span className="text-xs text-[#6E6D7A] shrink-0 font-normal">Ubah ▾</span>
      </button>

      <AppDialog open={open} onOpenChange={setOpen}>
        <AppDialogContent size="md">
          <AppDialogHeader>
            <p className="eyebrow text-[#6E6D7A]">Katalog idn-finlogos</p>
            <AppDialogTitle>Pilih Bank / E-Wallet</AppDialogTitle>
          </AppDialogHeader>

          <AppDialogBody className="space-y-4">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6E6D7A]" />
              <input
                type="text"
                placeholder="Cari BCA, Mandiri, GoPay, OVO..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (filteredProviders.length > 0) {
                      handleSelect(filteredProviders[0]);
                    } else if (search.trim()) {
                      handleCustomUse();
                    }
                  } else if (e.key === "Escape") {
                    setOpen(false);
                  }
                }}
                className="w-full rounded-lg border border-[#E8E6E1] bg-[#FBF9F5] pl-9 pr-3 py-2 text-sm text-[#1A1A1A] focus:outline-none focus:ring-2 focus:ring-[#1A1A1A]"
                autoFocus
              />
            </div>

            {/* Category Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
              {[
                { id: "all", label: "Semua" },
                { id: "bank", label: "Bank" },
                { id: "e-wallet", label: "E-Wallet" },
                { id: "credit-card", label: "Kartu Kredit / Paylater" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`rounded-full px-3 py-1 font-medium transition-all ${
                    selectedCategory === cat.id
                      ? "bg-[#1A1A1A] text-white"
                      : "bg-[#F0EEE9] text-[#6E6D7A] hover:bg-[#E8E6E1]"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Provider List */}
            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {filteredProviders.length > 0 ? (
                filteredProviders.map((item) => {
                  const isSelected = valueSlug === item.slug;
                  return (
                    <button
                      key={item.slug}
                      type="button"
                      onClick={() => handleSelect(item)}
                      className={`w-full flex items-center justify-between p-3 min-h-[44px] rounded-lg border text-left transition-all ${
                        isSelected
                          ? "border-[#1A1A1A] bg-[#F0EEE9]"
                          : "border-[#E8E6E1] bg-white hover:border-[#38484E] hover:bg-[#FBF9F5]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <ProviderAvatar slug={item.slug} name={item.name} size={32} />
                        <div>
                          <p className="text-sm font-semibold text-[#1A1A1A]">{item.name}</p>
                          <p className="text-xs text-[#6E6D7A] capitalize">{item.category}</p>
                        </div>
                      </div>
                      {isSelected && (
                        <span className="text-xs font-bold text-[#1A1A1A] bg-[#E8E6E1] px-2 py-0.5 rounded-full">
                          Terpilih
                        </span>
                      )}
                    </button>
                  );
                })
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-[#6E6D7A]">
                    Penyedia &quot;{search}&quot; tidak ditemukan dalam katalog terkurasi.
                  </p>
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={handleCustomUse}
                      className="mt-3 btn-compact bg-[#1A1A1A] text-white px-3 py-1.5 rounded-lg text-xs"
                    >
                      Gunakan nama custom &quot;{search.trim()}&quot;
                    </button>
                  )}
                </div>
              )}
            </div>
          </AppDialogBody>
        </AppDialogContent>
      </AppDialog>
    </div>
  );
}
