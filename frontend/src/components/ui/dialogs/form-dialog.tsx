"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

import {
  AppDialog,
  AppDialogContent,
  AppDialogHeader,
  AppDialogTitle,
  AppDialogDescription,
  AppDialogBody,
  AppDialogFooter,
} from "@/components/ui/dialog";
import { SubmitAction } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

export interface FormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  isDirty?: boolean;
  isSubmitting?: boolean;
  submitError?: string;
  submitLabel?: React.ReactNode;
  busyLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void | Promise<void>;
  children: React.ReactNode;
}

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  size = "md",
  isDirty = false,
  isSubmitting = false,
  submitError,
  submitLabel = "Simpan",
  busyLabel = "Menyimpan...",
  cancelLabel = "Batal",
  onSubmit,
  children,
}: FormDialogProps) {
  const [showDirtyAlert, setShowDirtyAlert] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowDirtyAlert(false);
    }
  }, [open]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isDirty) {
      setShowDirtyAlert(true);
      return;
    }
    onOpenChange(newOpen);
  };

  const handleCancelClick = () => {
    if (isDirty) {
      setShowDirtyAlert(true);
    } else {
      onOpenChange(false);
    }
  };

  const handleDiscardChanges = () => {
    formRef.current?.reset();
    setShowDirtyAlert(false);
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.requestSubmit();
    }
  };

  return (
    <>
      <AppDialog open={open} onOpenChange={handleOpenChange}>
        <AppDialogContent size={size}>
          <AppDialogHeader>
            <AppDialogTitle>{title}</AppDialogTitle>
            {description && (
              <AppDialogDescription>{description}</AppDialogDescription>
            )}
          </AppDialogHeader>

          <form
            ref={formRef}
            onSubmit={onSubmit}
            onKeyDown={handleKeyDown}
            className="flex flex-col min-h-0 flex-1 overflow-hidden"
          >
            <AppDialogBody>
              <AnimatePresence mode="wait">
                {submitError && (
                  <motion.div
                    key={submitError}
                    role="alert"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0, x: [-5, 5, -5, 5, 0] }}
                    exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
                    transition={{ duration: 0.4 }}
                    className="bg-[#FEE2E2] border border-[#FCA5A5] text-[#991B1B] px-4 py-3 rounded-lg mb-4 text-sm font-medium"
                  >
                    {submitError}
                  </motion.div>
                )}
              </AnimatePresence>
              {children}
            </AppDialogBody>

            <AppDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelClick}
                disabled={isSubmitting}
              >
                {cancelLabel}
              </Button>
              <SubmitAction
                isSubmitting={isSubmitting}
                label={submitLabel}
                busyLabel={busyLabel}
              />
            </AppDialogFooter>
          </form>
        </AppDialogContent>
      </AppDialog>

      <AppDialog open={showDirtyAlert} onOpenChange={setShowDirtyAlert}>
        <AppDialogContent size="sm" showCloseButton={false}>
          <AppDialogHeader>
            <AppDialogTitle>Ada perubahan belum disimpan</AppDialogTitle>
            <AppDialogDescription>
              Yakin ingin keluar? Perubahan yang telah Anda buat akan hilang.
            </AppDialogDescription>
          </AppDialogHeader>
          <AppDialogFooter>
            <Button variant="outline" onClick={() => setShowDirtyAlert(false)}>
              Lanjutkan Mengisi
            </Button>
            <Button variant="destructive" onClick={handleDiscardChanges}>
              Buang Perubahan
            </Button>
          </AppDialogFooter>
        </AppDialogContent>
      </AppDialog>
    </>
  );
}
