"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

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
      ...props
    },
    ref
  ) => {
    const { open } = React.useContext(DialogContext);
    const isDesktop = useMediaQuery("(min-width: 768px)");
    
    // We only mount after hydration to prevent hydration mismatch on media query
    const [mounted, setMounted] = React.useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    React.useEffect(() => setMounted(true), []);

    const sizeClasses = {
      sm: "md:max-w-[400px]",
      md: "md:max-w-[560px]",
      lg: "md:max-w-[720px]",
      xl: "md:max-w-[900px]",
      full: "md:max-w-[100vw] md:h-[100dvh] md:rounded-none",
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleInteractOutside = (e: any) => {
      if (preventBackdropClose) {
        e.preventDefault();
      }
      props.onInteractOutside?.(e);
    };

    // If not mounted yet, we can't reliably know isDesktop for animations
    // but typically dialogs are not open on initial render.
    if (!mounted && open) return null; 

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
                className="fixed inset-0 z-50 bg-[#1A1A1A]/40 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>
            
            {/* 
              We use a fixed wrapper with flex to center on desktop and align bottom on mobile.
              This avoids transform conflicts between Tailwind and Framer Motion.
            */}
            <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center pointer-events-none">
              <DialogPrimitive.Content
                ref={ref}
                asChild
                forceMount
                onInteractOutside={handleInteractOutside}
                {...props}
              >
                <motion.div
                  initial={isDesktop ? { opacity: 0, scale: 0.95 } : { opacity: 0, y: "100%" }}
                  animate={isDesktop ? { opacity: 1, scale: 1 } : { opacity: 1, y: 0 }}
                  exit={isDesktop ? { opacity: 0, scale: 0.95 } : { opacity: 0, y: "100%" }}
                  transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                  className={cn(
                    "pointer-events-auto w-full flex flex-col",
                    "bg-[#FFFEFC] text-[#25221F]",
                    "rounded-t-2xl md:rounded-2xl border-t md:border border-[#E5E1DB]",
                    "shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1),0_8px_10px_-6px_rgba(0,0,0,0.1)]",
                    "max-h-[90dvh] md:max-h-[85vh]", // container limits
                    sizeClasses[size],
                    className
                  )}
                >
                  {showDragHandle && (
                    <div className="md:hidden flex justify-center w-full pt-3 pb-1 shrink-0">
                      <div className="w-12 h-1.5 bg-[#DCD8D1] rounded-full" />
                    </div>
                  )}
                  {children}
                  {showCloseButton && (
                    <DialogPrimitive.Close className="absolute right-4 top-4 rounded-full p-1.5 text-[#706A63] hover:bg-[#F0EEE9] hover:text-[#25221F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D3935] z-10 transition-colors">
                      <X className="h-4 w-4" />
                      <span className="sr-only">Close</span>
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
    className={cn("flex flex-col space-y-1.5 px-6 py-5 shrink-0 border-b border-transparent", className)}
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
    className={cn("text-lg font-semibold leading-none tracking-tight text-[#25221F]", className)}
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
    className={cn("text-sm text-[#706A63]", className)}
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
        "flex-1 overflow-y-auto px-6 py-4",
        "max-h-[75vh] md:max-h-[60vh]",
        // dynamic scroll shadow fade (simplistic implementation using pure CSS radial/linear gradient or just normal padding)
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
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 px-6 py-4 shrink-0",
      "border-t border-[#E5E1DB] bg-[#FFFEFC] md:rounded-b-2xl",
      className
    )}
    {...props}
  />
));
AppDialogFooter.displayName = "AppDialogFooter";
