"use client";

import React, { useRef, useState } from "react";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogFooter,
  AppDialogClose,
  useMediaQuery,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ChevronsRight, Info, AlertOctagon, Loader2 } from "lucide-react";
import { haptics } from "@/lib/haptics";
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
  const isDanger = variant === "danger";
  // Touch screens confirm destructive actions with a deliberate slide; a stray tap can never trigger it.
  const isTouch = useMediaQuery("(pointer: coarse)");

  let Icon = AlertTriangle;
  let iconColor = "text-caution";
  let iconBg = "bg-caution-soft";
  let submitVariant: "default" | "destructive" = "default";
  let submitColorClass = "bg-caution-solid hover:bg-caution-solid text-white";

  if (variant === "danger") {
    Icon = AlertOctagon;
    iconColor = "text-negative";
    iconBg = "bg-negative-soft";
    submitVariant = "destructive";
    submitColorClass = "";
  } else if (variant === "info") {
    Icon = Info;
    iconColor = "text-info";
    iconBg = "bg-info-soft";
    submitColorClass = "bg-info-solid hover:bg-info-solid text-white";
  }

  return (
    <AppDialog open={open} onOpenChange={onOpenChange}>
      <AppDialogContent size="sm" showCloseButton={false}>
        <AppDialogHeader className="pr-5 md:pr-6">
          <div className="flex gap-4">
            <div className={cn("p-3 rounded-full flex-shrink-0 h-fit", iconBg, iconColor)}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <AppDialogTitle>{title}</AppDialogTitle>
              <AppDialogDescription className="whitespace-pre-wrap">{description}</AppDialogDescription>
            </div>
          </div>
        </AppDialogHeader>

        <AppDialogFooter className="border-t-0">
          <AppDialogClose asChild>
            <Button variant="outline" disabled={isConfirming}>
              {cancelLabel}
            </Button>
          </AppDialogClose>

          {isDanger && isTouch ? (
            <SlideToConfirm label={confirmLabel} busy={isConfirming} onConfirm={() => void onConfirm()} />
          ) : (
            <Button
              variant={submitVariant}
              className={cn("select-none", submitColorClass)}
              onClick={() => void onConfirm()}
              disabled={isConfirming}
            >
              {isConfirming && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmLabel}
            </Button>
          )}
        </AppDialogFooter>
      </AppDialogContent>
    </AppDialog>
  );
}

const THUMB = 48;
const TRACK_PAD = 4;

/** Drag the thumb to the end of the track to confirm. Enter/Space on the thumb confirms for keyboard users. */
function SlideToConfirm({ label, busy, onConfirm }: { label: string; busy: boolean; onConfirm: () => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const x = useMotionValue(0);
  const labelOpacity = useTransform(x, [0, 120], [1, 0]);
  const fillWidth = useTransform(x, (value) => value + THUMB + TRACK_PAD * 2);

  const travel = () => Math.max(0, (trackRef.current?.offsetWidth ?? 0) - THUMB - TRACK_PAD * 2 - 2);

  const finish = () => {
    setDone(true);
    haptics.warn();
    void animate(x, travel(), { duration: 0.12 });
    onConfirm();
  };

  return (
    <div
      ref={trackRef}
      data-slide-confirm=""
      className="relative h-14 select-none overflow-hidden rounded-full border border-negative-line bg-negative-soft"
    >
      <motion.div aria-hidden="true" style={{ width: fillWidth }} className="absolute inset-y-0 left-0 rounded-full bg-negative-line" />
      <motion.span
        aria-hidden="true"
        style={{ opacity: labelOpacity }}
        className="pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-sm font-semibold text-negative"
      >
        Geser untuk {label.toLowerCase()}
      </motion.span>
      <motion.button
        type="button"
        aria-label={`${label}. Geser ke kanan, atau tekan Enter, untuk mengonfirmasi.`}
        disabled={busy || done}
        drag={busy || done ? false : "x"}
        dragConstraints={trackRef}
        dragElastic={0}
        dragMomentum={false}
        style={{ x, top: TRACK_PAD - 1, left: TRACK_PAD, width: THUMB, height: THUMB }}
        onDragEnd={() => {
          if (x.get() >= travel() * 0.86) finish();
          else void animate(x, 0, { type: "spring", stiffness: 500, damping: 36 });
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            finish();
          }
        }}
        className="absolute flex touch-none items-center justify-center rounded-full bg-negative-solid text-white shadow-md disabled:opacity-100"
      >
        {busy || done ? <Loader2 className="size-5 animate-spin" /> : <ChevronsRight className="size-5" />}
      </motion.button>
    </div>
  );
}
