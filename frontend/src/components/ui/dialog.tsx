"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useDragControls, type PanInfo } from "framer-motion";
import { ChevronLeft, X } from "lucide-react";

import { spring } from "@/lib/motion";
import { pushSheetEntry, releaseSheetEntry } from "@/lib/sheet-history";
import { cn } from "@/lib/utils";

/**
 * The last control used outside any dialog. Sheets here are opened by controlled state rather
 * than a Radix Trigger, and iOS Safari never focuses tapped buttons, so Radix has nothing
 * reliable to hand focus back to on close. Pointer and focus events outside dialogs are
 * tracked instead, and a closing sheet returns focus to that control.
 */
let lastOutsideControl: HTMLElement | null = null;
if (typeof document !== "undefined") {
  const remember = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    const control = target?.closest<HTMLElement>("button, a[href], [tabindex]:not([tabindex='-1']), input, select, textarea");
    if (control && !control.closest('[role="dialog"]')) lastOutsideControl = control;
  };
  document.addEventListener("pointerdown", remember, true);
  document.addEventListener("focusin", remember, true);
}

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
}>({
  open: false,
  setOpen: () => {},
});

export const AppDialog: React.FC<DialogPrimitive.DialogProps> = ({
  children,
  open: openProp,
  onOpenChange,
  ...props
}) => {
  const [internalOpen, setInternalOpen] = React.useState(openProp || false);
  const isControlled = openProp !== undefined;
  const open = isControlled ? openProp : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (!isControlled) setInternalOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <DialogContext.Provider value={{ open, setOpen: handleOpenChange }}>
      <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange} {...props}>
        {children}
      </DialogPrimitive.Root>
    </DialogContext.Provider>
  );
};

export const AppDialogTrigger = DialogPrimitive.Trigger;
export const AppDialogClose = DialogPrimitive.Close;

export interface AppDialogContentProps
  extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  showDragHandle?: boolean;
  preventBackdropClose?: boolean;
  /** Mobile sheet height: "content" hugs its content, "half" opens at a half stop and can be dragged to full. */
  snap?: "content" | "half";
}

export function useMediaQuery(query: string) {
  const [value, setValue] = React.useState(false);

  React.useEffect(() => {
    function onChange(event: MediaQueryListEvent) {
      setValue(event.matches);
    }

    const result = matchMedia(query);
    result.addEventListener("change", onChange);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(result.matches);

    return () => result.removeEventListener("change", onChange);
  }, [query]);

  return value;
}

/** The sheet element that in-sheet steps (see SheetStep) render into. */
const SheetHostContext = React.createContext<HTMLElement | null>(null);

export function useSheetHost() {
  return React.useContext(SheetHostContext);
}

/**
 * A second "page" inside the current sheet (e.g. a picker), instead of stacking another sheet on top.
 * Renders nothing when there is no enclosing sheet; callers should fall back to a dialog then.
 */
export function SheetStep({
  open,
  onBack,
  title,
  children,
}: {
  open: boolean;
  onBack: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  const host = useSheetHost();

  React.useEffect(() => {
    if (!open || !host) return;
    const previous = host.style.minHeight;
    host.style.setProperty("min-height", "min(72dvh, 36rem)");
    return () => {
      host.style.setProperty("min-height", previous);
    };
  }, [open, host]);

  if (!host) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          role="group"
          aria-label={typeof title === "string" ? title : undefined}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={spring.soft}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              onBack();
            }
          }}
          className="absolute inset-0 z-20 flex flex-col overflow-hidden rounded-[inherit] bg-paper"
        >
          <div className="flex shrink-0 items-center gap-1 border-b border-line px-2 py-2">
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali"
              className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-paper-sunk"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <p className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{title}</p>
          </div>
          <div className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>,
    host
  );
}

export const AppDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  AppDialogContentProps
>(
  (
    {
      className,
      children,
      size = "md",
      showCloseButton = true,
      showDragHandle = true,
      preventBackdropClose = false,
      snap = "content",
      ...props
    },
    ref
  ) => {
    const { open, setOpen } = React.useContext(DialogContext);
    const isDesktop = useMediaQuery("(min-width: 768px)");
    const dragControls = useDragControls();
    const [expanded, setExpanded] = React.useState(false);
    const [host, setHost] = React.useState<HTMLElement | null>(null);

    // We only mount after hydration to prevent hydration mismatch on media query
    const [mounted, setMounted] = React.useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    React.useEffect(() => setMounted(true), []);

    // Android back button / browser back closes the sheet rather than leaving the page.
    // Captured when the sheet opens; focus goes back here when it closes.
    const returnFocus = React.useRef<HTMLElement | null>(null);
    React.useEffect(() => {
      if (open) returnFocus.current = lastOutsideControl;
    }, [open]);
    const handleCloseAutoFocus = (event: Event) => {
      props.onCloseAutoFocus?.(event);
      if (event.defaultPrevented) return;
      const target = returnFocus.current;
      if (target?.isConnected) {
        event.preventDefault();
        target.focus({ preventScroll: true });
      }
    };

    const closeRef = React.useRef(() => setOpen(false));
    React.useEffect(() => {
      closeRef.current = () => setOpen(false);
    });
    React.useEffect(() => {
      if (!open || !mounted || isDesktop) return;
      const id = pushSheetEntry(() => closeRef.current());
      return () => releaseSheetEntry(id);
    }, [open, mounted, isDesktop]);

    React.useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!open) setExpanded(false);
    }, [open]);

    const sizeClasses = {
      sm: "md:max-w-[400px]",
      md: "md:max-w-[560px]",
      lg: "md:max-w-[720px]",
      xl: "md:max-w-[900px]",
      full: "md:max-w-[100vw] md:h-[100dvh] md:rounded-none",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleInteractOutside = (e: any) => {
      // Toasts live outside the dialog; swiping or tapping one must not close the sheet under it.
      if (preventBackdropClose || (e.target as HTMLElement | null)?.closest?.("[data-toast-region]")) {
        e.preventDefault();
      }
      props.onInteractOutside?.(e);
    };

    const handleDragEnd = (_: unknown, info: PanInfo) => {
      const { offset, velocity } = info;
      if (snap === "half" && !expanded && (offset.y < -48 || velocity.y < -500)) {
        setExpanded(true);
        return;
      }
      if (offset.y > 110 || velocity.y > 650) {
        if (snap === "half" && expanded && offset.y < 260) setExpanded(false);
        else setOpen(false);
      }
    };

    // If not mounted yet, we can't reliably know isDesktop for animations
    // but typically dialogs are not open on initial render.
    if (!mounted && open) return null;

    const isSheet = !isDesktop;

    return (
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px]"
              />
            </DialogPrimitive.Overlay>

            {/*
              A fixed flex wrapper centers on desktop and bottom-aligns on mobile, which avoids
              transform conflicts with Framer Motion. Its bottom padding lifts the sheet above
              the iOS on-screen keyboard.
            */}
            <div
              className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none"
              style={isSheet ? { paddingBottom: "var(--kb)" } : undefined}
            >
              <DialogPrimitive.Content
                ref={ref}
                asChild
                forceMount
                {...props}
                onInteractOutside={handleInteractOutside}
                onCloseAutoFocus={handleCloseAutoFocus}
              >
                <motion.div
                  ref={setHost}
                  data-sheet={isSheet ? "" : undefined}
                  initial={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
                  animate={isDesktop ? { opacity: 1, scale: 1 } : { y: 0 }}
                  exit={isDesktop ? { opacity: 0, scale: 0.95 } : { y: "100%" }}
                  transition={isDesktop ? { type: "spring", bounce: 0, duration: 0.3 } : spring.soft}
                  drag={isSheet ? "y" : false}
                  dragControls={dragControls}
                  dragListener={false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: snap === "half" && !expanded ? 0.25 : 0, bottom: 0.7 }}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "pointer-events-auto relative w-full flex flex-col overflow-hidden",
                    "bg-paper text-ink",
                    "rounded-t-[1.75rem] md:rounded-2xl border-t md:border border-line",
                    "shadow-[0_-8px_40px_-12px_rgb(var(--shadow-color)/0.35)] md:shadow-[0_20px_40px_-12px_rgb(var(--shadow-color)/0.3)]",
                    "sheet-max-h md:max-h-[85dvh]",
                    isSheet && snap === "half" && "transition-[height] duration-300",
                    isSheet && snap === "half" && (expanded ? "h-[calc(100dvh-var(--kb)-1.5rem)]" : "h-[62dvh]"),
                    sizeClasses[size],
                    className
                  )}
                >
                  {showDragHandle && (
                    <div
                      aria-hidden="true"
                      onPointerDown={(event) => dragControls.start(event)}
                      className="md:hidden flex w-full shrink-0 cursor-grab touch-none justify-center pt-2.5 pb-1.5 active:cursor-grabbing"
                    >
                      <div className="h-1.5 w-11 rounded-full bg-line-strong" />
                    </div>
                  )}
                  <SheetHostContext.Provider value={host}>{children}</SheetHostContext.Provider>
                  {showCloseButton && (
                    <DialogPrimitive.Close className="absolute right-3 top-3 z-10 flex size-11 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper-sunk hover:text-ink md:right-4 md:top-4 md:size-8">
                      <X className="h-4 w-4" />
                      <span className="sr-only">Tutup</span>
                    </DialogPrimitive.Close>
                  )}
                </motion.div>
              </DialogPrimitive.Content>
            </div>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    );
  }
);
AppDialogContent.displayName = "AppDialogContent";

export const AppDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex shrink-0 flex-col space-y-1.5 px-5 pb-4 pt-2 pr-14 md:px-6 md:py-5 md:pr-14", className)}
    {...props}
  />
));
AppDialogHeader.displayName = "AppDialogHeader";

export const AppDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-tight tracking-tight text-ink", className)}
    {...props}
  />
));
AppDialogTitle.displayName = "AppDialogTitle";

export const AppDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-ink-soft", className)}
    {...props}
  />
));
AppDialogDescription.displayName = "AppDialogDescription";

export const AppDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        "min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 md:px-6",
        "md:max-h-[60dvh]",
        className
      )}
      {...props}
    />
  );
});
AppDialogBody.displayName = "AppDialogBody";

export const AppDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Mobile: full-width stacked actions that clear the home indicator and the keyboard.
      "safe-bottom flex shrink-0 flex-col-reverse gap-2.5 px-5 pt-3 [&>*]:w-full",
      "sm:flex-row sm:justify-end sm:gap-3 sm:px-6 sm:py-4 sm:[&>*]:w-auto",
      "border-t border-line bg-paper md:rounded-b-2xl",
      className
    )}
    {...props}
  />
));
AppDialogFooter.displayName = "AppDialogFooter";
