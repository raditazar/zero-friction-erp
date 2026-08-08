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
  const holdTimeout = useRef<NodeJS.Timeout | null>(null);

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

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!isDanger || isConfirming) return;
    // Hanya klik utama (kiri) yang diterima
    if (e.button !== 0) return;
    
    setIsHolding(true);
    
    holdTimeout.current = setTimeout(() => {
      setIsHolding(false);
      onConfirm();
    }, 2000);
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

  // Mencegah context menu yang bisa membatalkan event pointerDown di mobile/desktop
  const handleContextMenu = (e: React.MouseEvent) => {
    if (isDanger) e.preventDefault();
  };

  // Setup ikon dan warna berdasarkan varian
  let Icon = AlertTriangle;
  let iconColor = "text-amber-600 dark:text-amber-500";
  let iconBg = "bg-amber-100 dark:bg-amber-500/10";
  let submitVariant: "default" | "destructive" = "default";
  let submitColorClass = "";

  if (variant === "danger") {
    Icon = AlertOctagon;
    iconColor = "text-red-600 dark:text-red-500";
    iconBg = "bg-red-100 dark:bg-red-500/10";
    submitVariant = "destructive";
  } else if (variant === "info") {
    Icon = Info;
    iconColor = "text-blue-600 dark:text-blue-500";
    iconBg = "bg-blue-100 dark:bg-blue-500/10";
    submitVariant = "default";
    submitColorClass = "bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700";
  } else if (variant === "warning") {
    Icon = AlertTriangle;
    iconColor = "text-amber-600 dark:text-amber-500";
    iconBg = "bg-amber-100 dark:bg-amber-500/10";
    submitVariant = "default";
    submitColorClass = "bg-amber-600 hover:bg-amber-700 text-white dark:bg-amber-600 dark:hover:bg-amber-700";
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
            <Button variant="outline" disabled={isConfirming || isHolding} className="mt-2 sm:mt-0 w-full sm:w-auto">
              {cancelLabel}
            </Button>
          </AppDialogClose>
          
          <Button
            variant={submitVariant}
            className={cn(
              "relative overflow-hidden w-full sm:w-auto select-none", 
              submitColorClass,
              isHolding && "scale-[0.98] transition-transform duration-200"
            )}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            onPointerCancel={handlePointerCancel}
            onContextMenu={handleContextMenu}
            disabled={isConfirming}
          >
            {isDanger && (
              <motion.div
                className="absolute inset-0 bg-black/20 dark:bg-white/20 origin-left"
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
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}
