"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Info, AlertOctagon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description: React.ReactNode;
  variant?: "danger" | "warning" | "info";
  confirmLabel?: string;
  cancelLabel?: string;
  isConfirming?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  variant = "warning",
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  isConfirming = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [isHolding, setIsHolding] = useState(false);
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDanger = variant === "danger";

  // Membersihkan timeout saat unmount atau modal tertutup
  useEffect(() => {
    if (!open) {
      if (holdTimeout.current) {
        clearTimeout(holdTimeout.current);
        holdTimeout.current = null;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsHolding(false);
    }
    return () => {
      if (holdTimeout.current) clearTimeout(holdTimeout.current);
    };
  }, [open]);

  const beginDangerConfirmation = () => {
    if (holdTimeout.current) return;

    setIsHolding(true);
    holdTimeout.current = setTimeout(() => {
      holdTimeout.current = null;
      setIsHolding(false);
      void onConfirm();
    }, 2000);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDanger || isConfirming) return;
    // Hanya klik utama (kiri) yang diterima
    if (e.button !== 0) return;
    beginDangerConfirmation();
  };

  const handlePointerCancel = () => {
    if (!isDanger || isConfirming) return;
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
      holdTimeout.current = null;
    }
    setIsHolding(false);
  };

  const handleClick = () => {
    if (isDanger) return; // Danger hanya melalui onPointerDown -> hold
    onConfirm();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isDanger || isConfirming || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    beginDangerConfirmation();
  };

  const handleKeyUp = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!isDanger || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    handlePointerCancel();
  };

  // Mencegah context menu yang bisa membatalkan event pointerDown di mobile/desktop
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isDanger) e.preventDefault();
  };

  // Setup ikon dan warna berdasarkan varian
  let Icon = AlertTriangle;
  let iconColor = "text-caution";
  let iconBg = "bg-caution-soft";
  let submitVariant: "default" | "destructive" = "default";
  let submitColorClass = "";

  if (variant === "danger") {
    Icon = AlertOctagon;
    iconColor = "text-negative";
    iconBg = "bg-negative-soft";
    submitVariant = "destructive";
  } else if (variant === "info") {
    Icon = Info;
    iconColor = "text-info";
    iconBg = "bg-info-soft";
    submitVariant = "default";
    submitColorClass = "bg-info-solid hover:bg-info-solid text-white";
  } else if (variant === "warning") {
    Icon = AlertTriangle;
    iconColor = "text-caution";
    iconBg = "bg-caution-soft";
    submitVariant = "default";
    submitColorClass = "bg-caution-solid hover:bg-caution-solid text-white";
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="sm">
        <AppDialogHeader>
          <div className="flex gap-4">
            <div className={cn("p-3 rounded-full flex-shrink-0 h-fit", iconBg, iconColor)}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex flex-col gap-1">
              <AppDialogTitle>{title}</AppDialogTitle>
              <AppDialogDescription className="text-sm text-muted-foreground whitespace-pre-wrap">
                {description}
              </AppDialogDescription>
            </div>
          </div>
        </AppDialogHeader>
        
        <AppDialogFooter className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2">
          <AppDialogClose asChild>
            <Button variant="outline" disabled={isConfirming || isHolding} className="mt-2 sm:mt-0 w-full sm:w-auto min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2">
              {cancelLabel}
            </Button>
          </AppDialogClose>
          
          <Button
            variant={submitVariant}
            className={cn(
              "relative overflow-hidden w-full sm:w-auto select-none min-h-[44px] focus-visible:ring-2 focus-visible:ring-offset-2", 
              submitColorClass,
              isHolding && "scale-[0.98] transition-transform duration-200"
            )}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            onPointerCancel={handlePointerCancel}
            onKeyDown={handleKeyDown}
            onKeyUp={handleKeyUp}
            onContextMenu={handleContextMenu}
            disabled={isConfirming}
            aria-describedby={isDanger ? "danger-confirmation-instructions" : undefined}
          >
            {isDanger && (
              <motion.div
                className="absolute inset-0 bg-black/20 origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: isHolding ? 1 : 0 }}
                transition={{ 
                  duration: isHolding ? 2 : 0.3, 
                  ease: isHolding ? "linear" : "easeOut" 
                }}
              />
            )}
            
            <div className="relative z-10 flex items-center justify-center gap-2 w-full">
              {isConfirming && <Loader2 className="w-4 h-4 animate-spin" />}
              {isDanger ? (
                isHolding ? "Tahan untuk konfirmasi" : confirmLabel
              ) : (
                confirmLabel
              )}
            </div>
          </Button>
          {isDanger ? <span id="danger-confirmation-instructions" className="sr-only">Tekan dan tahan tombol ini selama dua detik dengan penunjuk, Enter, atau Spasi untuk mengonfirmasi.</span> : null}
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
