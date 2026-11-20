import { cn } from "@/lib/utils";

/**
 * Sunk round dish a 3D object sits in, so the coloured object reads as resting in the soft
 * paper rather than floating on top of it. Decorative only; place it before the object inside
 * a `relative overflow-hidden` parent.
 */
export function SceneWell({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("pointer-events-none absolute rounded-full surface-inset", className)}
    />
  );
}
