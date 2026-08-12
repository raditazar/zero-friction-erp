"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  action?: ToastAction;
};

export type ToastOptions = Partial<Omit<ToastPayload, "message">>;
export type ToastInput = string | ToastPayload;

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
  detail?: string;
  action?: ToastAction;
};

export type ToastApi = {
  [K in ToastKind]: (input: ToastInput, options?: ToastOptions) => void;
};

let nextId = 0;
let publish: ((toast: ToastItem) => void) | undefined;

function parseInput(input: ToastInput, options?: ToastOptions): { message: string; detail?: string; action?: ToastAction } {
  if (typeof input === "string") {
    return {
      message: input,
      detail: options?.detail,
      action: options?.action,
    };
  }
  return {
    message: input.message,
    detail: input.detail ?? options?.detail,
    action: input.action ?? options?.action,
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
  { borderLeft: string; iconColor: string; icon: React.ElementType }
> = {
  success: {
    borderLeft: "border-l-[#059669]",
    iconColor: "text-[#059669]",
    icon: CheckCircle2,
  },
  warning: {
    borderLeft: "border-l-[#D97706]",
    iconColor: "text-[#D97706]",
    icon: TriangleAlert,
  },
  info: {
    borderLeft: "border-l-[#4F46E5]",
    iconColor: "text-[#4F46E5]",
    icon: Info,
  },
  error: {
    borderLeft: "border-l-[#DC2626]",
    iconColor: "text-[#DC2626]",
    icon: CircleAlert,
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((items) => items.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    publish = (item) => setToasts((items) => [...items, item]);
    return () => {
      publish = undefined;
    };
  }, []);

  const api = useMemo(() => toast, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 pointer-events-none"
      >
        {toasts.slice(0, 3).map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <ToastCard item={item} dismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ item, dismiss }: { item: ToastItem; dismiss: (id: number) => void }) {
  useEffect(() => {
    if (item.kind === "error" || item.kind === "warning") return;

    const timer = window.setTimeout(() => {
      dismiss(item.id);
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [item.id, item.kind, dismiss]);

  const statusInfo = statusStyles[item.kind];
  const Icon = statusInfo.icon;

  return (
    <section
      role={item.kind === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`relative flex items-start gap-3 rounded-xl border border-[#E8E5DF] border-l-4 ${statusInfo.borderLeft} bg-[#F4F3EE] p-4 text-[#1A1A1A] shadow-lg transition-all duration-200`}
    >
      <Icon aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${statusInfo.iconColor}`} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-tight text-[#1A1A1A]">{item.message}</p>
        {item.detail && (
          <p className="mt-1 text-xs leading-relaxed text-[#1A1A1A]/80">{item.detail}</p>
        )}
        {item.action && (
          <div className="mt-2">
            {item.action.href ? (
              <a
                href={item.action.href}
                onClick={item.action.onClick}
                className="inline-flex items-center rounded text-xs font-semibold text-[#1A1A1A] underline underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2"
              >
                {item.action.label}
              </a>
            ) : (
              <button
                type="button"
                onClick={item.action.onClick}
                className="inline-flex items-center rounded text-xs font-semibold text-[#1A1A1A] underline underline-offset-2 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-2"
              >
                {item.action.label}
              </button>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => dismiss(item.id)}
        className="-mr-1 -mt-1 rounded-md p-1.5 text-[#1A1A1A]/60 transition-colors hover:bg-[#E8E5DF]/60 hover:text-[#1A1A1A] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1A1A1A] focus-visible:ring-offset-1"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </section>
  );
}
