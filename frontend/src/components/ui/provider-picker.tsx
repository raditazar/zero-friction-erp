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
  SheetStep,
  useSheetHost,
} from "./dialog";
import { ChevronDown, Search } from "lucide-react";

interface ProviderPickerProps {
  valueSlug?: string;
  valueName?: string;
  onChange: (provider: { slug: string; name: string }) => void;
}

const CATEGORIES = [
  { id: "all", label: "Semua" },
  { id: "bank", label: "Bank" },
  { id: "e-wallet", label: "E-Wallet" },
  { id: "credit-card", label: "Kartu Kredit / Paylater" },
];

export function ProviderPicker({
  valueSlug,
  valueName,
  onChange,
}: ProviderPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  // Inside a sheet the picker becomes a step of that sheet rather than a second sheet on top.
  const sheetHost = useSheetHost();

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

  function close() {
    setOpen(false);
    setSearch("");
  }

  function handleSelect(item: ProviderItem) {
    onChange({ slug: item.slug, name: item.name });
    close();
  }

  function handleCustomUse() {
    if (search.trim()) {
      onChange({ slug: "", name: search.trim() });
      close();
    }
  }

  const selectedItem = PROVIDER_CATALOG.find((p) => p.slug === valueSlug);
  const displayTitle = selectedItem?.name || valueName || "Pilih Penyedia Bank / E-Wallet";

  const body = (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" aria-hidden="true" />
        <input
          type="search"
          aria-label="Cari penyedia"
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
            }
          }}
          className="h-11 w-full rounded-xl border border-line-strong bg-card pl-9 pr-3 text-sm text-ink outline-none focus:border-ink"
        />
      </div>

      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 text-sm">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            aria-pressed={selectedCategory === cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 font-medium transition-colors ${
              selectedCategory === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-paper-sunk text-ink-soft"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        {filteredProviders.length > 0 ? (
          filteredProviders.map((item) => {
            const isSelected = valueSlug === item.slug;
            return (
              <button
                key={item.slug}
                type="button"
                onClick={() => handleSelect(item)}
                className={`flex min-h-[44px] w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                  isSelected
                    ? "border-ink bg-paper-sunk"
                    : "border-line bg-card hover:border-ink-faint hover:bg-paper"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ProviderAvatar slug={item.slug} name={item.name} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                    <p className="text-xs capitalize text-ink-soft">{item.category}</p>
                  </div>
                </div>
                {isSelected && (
                  <span className="shrink-0 rounded-full bg-mint-soft px-2 py-0.5 text-xs font-bold text-ink">
                    Terpilih
                  </span>
                )}
              </button>
            );
          })
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-ink-soft">
              &quot;{search}&quot; tidak ada di katalog.
            </p>
            {search.trim() && (
              <button type="button" onClick={handleCustomUse} className="btn-primary mt-3">
                Pakai nama &quot;{search.trim()}&quot;
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Pilih Bank atau E-Wallet"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-[0.625rem] border-line-strong surface-raised px-3 py-2 text-left text-sm font-medium text-ink transition-colors hover:border-ink-faint"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <ProviderAvatar slug={valueSlug} name={displayTitle} size={28} />
          <span className="truncate">{displayTitle}</span>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs font-normal text-ink-soft">
          Ubah <ChevronDown className="size-3.5" aria-hidden="true" />
        </span>
      </button>

      {sheetHost ? (
        <SheetStep open={open} onBack={close} title="Pilih Bank / E-Wallet">
          {body}
        </SheetStep>
      ) : (
        <AppDialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
          <AppDialogContent size="md">
            <AppDialogHeader>
              <AppDialogTitle>Pilih Bank / E-Wallet</AppDialogTitle>
            </AppDialogHeader>
            <AppDialogBody>{body}</AppDialogBody>
          </AppDialogContent>
        </AppDialog>
      )}
    </div>
  );
}
