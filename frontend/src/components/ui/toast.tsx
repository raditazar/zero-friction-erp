"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { spring } from "@/lib/motion";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";

export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastAction = {
  label: string;
  href?: string;
  onClick?: () => void;
};

export type ToastPayload = {
  message: string;
  detail?: string;
  /** e.g. { label: "Urungkan", onClick } - the toast closes after the action runs. */
  action?: ToastAction;
  /** Milliseconds before auto-dismiss. Errors and warnings stay until closed unless set. */
  duration?: number;
};

export type ToastOptions = Partial<Omit<ToastPayload, "message">>;
export type ToastInput = string | ToastPayload;

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
  action?: ToastAction;
  duration?: number;
};

export type ToastApi = {
  [K in ToastKind]: (input: ToastInput, options?: ToastOptions) => void;
};

let nextId = 0;
let publish: ((toast: ToastItem) => void) | undefined;

function parseInput(input: ToastInput, options?: ToastOptions): Omit<ToastItem, "id" | "kind"> {
  if (typeof input === "string") {
    return {
      message: input,
      detail: options?.detail,
      action: options?.action,
      duration: options?.duration,
    };
  }
  return {
    message: input.message,
    detail: input.detail ?? options?.detail,
    action: input.action ?? options?.action,
    duration: input.duration ?? options?.duration,
  };
}

function add(kind: ToastKind, input: ToastInput, options?: ToastOptions) {
  const parsed = parseInput(input, options);
  publish?.({
    id: ++nextId,
    kind,
    ...parsed,
  });
}

export const toast: ToastApi = {
  success: (input, options) => add("success", input, options),
  error: (input, options) => add("error", input, options),
  warning: (input, options) => add("warning", input, options),
  info: (input, options) => add("info", input, options),
};

const ToastContext = createContext<ToastApi>(toast);

export function useToast() {
  return useContext(ToastContext);
}

const statusStyles: Record<
  ToastKind,
  { iconColor: string; icon: React.ElementType }
> = {
  success: {
    iconColor: "text-positive",
    icon: CheckCircle2,
  },
  warning: {
    iconColor: "text-caution",
    icon: TriangleAlert,
  },
  info: {
    iconColor: "text-info",
    icon: Info,
  },
  error: {
    iconColor: "text-negative",
    icon: CircleAlert,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    // Newest first; keep at most three on screen.
    publish = (item) => setToasts((items) => [item, ...items].slice(0, 3));
    return () => {
      publish = undefined;
    };
  }, []);

  const api = useMemo(() => toast, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Mobile: drops in below the header. Desktop: bottom right. Sits above sheets and dialogs. */}
      <div
        data-toast-region=""
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Notifikasi"
        className="pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-[80] flex flex-col gap-2 md:inset-x-auto md:top-auto md:bottom-4 md:right-4 md:w-[24rem] md:flex-col-reverse"
      >
        <AnimatePresence initial={false}>
          {toasts.map((item) => (
            <ToastCard key={item.id} item={item} dismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  useEffect(() => {
    const sticky = item.kind === "error" || item.kind === "warning";
    const duration = item.duration ?? (sticky ? 0 : item.action ? 5000 : 4000);
    if (!duration) return;

    const timer = window.setTimeout(() => dismiss(item.id), duration);
    return () => window.clearTimeout(timer);
  }, [item.id, item.kind, item.duration, item.action, dismiss]);

  const statusInfo = statusStyles[item.kind];
  const Icon = statusInfo.icon;
  const actionClass =
    "touch-compact inline-flex min-h-11 shrink-0 items-center rounded-full bg-paper-sunk px-3.5 text-sm font-semibold text-ink hover:bg-line";

  return (
    <motion.section
      layout
      role={item.kind === "error" ? "alert" : "status"}
      initial={{ opacity: 0, y: -18, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={spring.soft}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 500) dismiss(item.id);
      }}
      className="pointer-events-auto relative flex touch-pan-y items-center gap-3 rounded-2xl border border-line bg-card-raised py-2 pl-4 pr-1.5 text-ink shadow-[0_12px_32px_-12px_rgb(var(--shadow-color)/0.4)]"
    >
      <Icon aria-hidden="true" className={`h-5 w-5 shrink-0 ${statusInfo.iconColor}`} />

      <div className="min-w-0 flex-1 py-1.5">
        <p className="text-sm font-semibold leading-snug text-ink">{item.message}</p>
        {item.detail && <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{item.detail}</p>}
      </div>

      {item.action ? (
        item.action.href ? (
          <a
            href={item.action.href}
            data-touch=""
            onClick={() => {
              item.action?.onClick?.();
              dismiss(item.id);
            }}
            className={actionClass}
          >
            {item.action.label}
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              item.action?.onClick?.();
              dismiss(item.id);
            }}
            className={actionClass}
          >
            {item.action.label}
          </button>
        )
      ) : null}

      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => dismiss(item.id)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper-sunk hover:text-ink md:size-9"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </motion.section>
  );
}
