"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogBody,
} from "../dialog";

export interface ShortcutItem {
  id: string;
  title: string;
  category: string;
  keys: string[];
  description?: string;
}

export interface HelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shortcuts?: ShortcutItem[];
  enableGlobalShortcut?: boolean;
}

export const HelpDialog: React.FC<HelpDialogProps> = ({
  open,
  onOpenChange,
  shortcuts = [],
  enableGlobalShortcut = true,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<string>("All");

  useEffect(() => {
    if (!enableGlobalShortcut) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      // Check for "?" (Shift + /) or Cmd+/ or Ctrl+/
      const isQuestionMark = e.key === "?";
      const isCmdSlash = (e.metaKey || e.ctrlKey) && e.key === "/";

      if (isQuestionMark || isCmdSlash) {
        e.preventDefault();
        onOpenChange(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enableGlobalShortcut, onOpenChange]);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    shortcuts.forEach((s) => cats.add(s.category));
    return ["All", ...Array.from(cats)];
  }, [shortcuts]);

  const filteredShortcuts = useMemo(() => {
    let filtered = shortcuts;
    
    if (activeTab !== "All") {
      filtered = filtered.filter((s) => s.category === activeTab);
    }
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.category.toLowerCase().includes(q)
      );
    }
    
    return filtered;
  }, [shortcuts, searchQuery, activeTab]);

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="lg" className="flex flex-col overflow-hidden max-h-[85dvh] md:max-h-[80dvh]">
        <AppDialogHeader className="pb-4">
          <AppDialogTitle className="flex items-center justify-between">
            Help & Shortcuts
            {searchQuery && (
              <span className="text-xs bg-paper-sunk text-ink px-2 py-0.5 rounded-full font-medium">
                {filteredShortcuts.length} result{filteredShortcuts.length !== 1 && "s"}
              </span>
            )}
          </AppDialogTitle>
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-soft" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-paper border border-line text-ink rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-ink focus:border-transparent transition-all placeholder:text-ink-faint"
            />
          </div>
          {categories.length > 1 && (
            <div className="mt-4 flex space-x-2 overflow-x-auto pb-1 scrollbar-hide" role="tablist" aria-label="Shortcut Categories">
              {categories.map((cat) => (
                <button
                  key={cat}
                  role="tab"
                  aria-selected={activeTab === cat}
                  onClick={() => setActiveTab(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink",
                    activeTab === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-paper-sunk text-ink-soft hover:bg-paper-sunk"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </AppDialogHeader>
        <AppDialogBody className="flex-1 overflow-y-auto p-0">
          {filteredShortcuts.length > 0 ? (
            <div className="divide-y divide-line">
              {filteredShortcuts.map((shortcut) => (
                <div key={shortcut.id} className="flex items-center justify-between px-6 py-4 hover:bg-paper transition-colors">
                  <div className="pr-4">
                    <h4 className="text-ink font-medium">{shortcut.title}</h4>
                    {shortcut.description && (
                      <p className="text-ink-soft text-sm mt-0.5">{shortcut.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    {shortcut.keys.map((key, idx) => (
                      <kbd
                        key={idx}
                        className="bg-paper-sunk border border-line-strong text-ink font-mono shadow-sm px-1.5 py-0.5 rounded text-xs"
                      >
                        {key}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <p className="text-ink-soft font-medium">No shortcuts found</p>
              <p className="text-sm text-ink-faint mt-1">Try searching for something else.</p>
            </div>
          )}
        </AppDialogBody>
      </AppDialogContent>
    </AppDialog>
  );
};
