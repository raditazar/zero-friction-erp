import { cn } from "@/lib/utils";

/**
 * Flat stand-in for the 3D coin stack: shown before the WebGL chunk arrives and kept for
 * reduced motion, Save-Data and low-end devices. Same ivory-with-mint-edge coins.
 */
export function CoinStackStatic({ count = 6, className }: { count?: number; className?: string }) {
  const coins = Math.max(1, Math.min(9, Math.round(count)));
  const step = 15;
  const baseY = 178;
  return (
    <svg viewBox="0 0 160 200" aria-hidden="true" className={cn("h-full w-full", className)}>
      <ellipse cx={80} cy={baseY + 12} rx={58} ry={9} fill="rgb(var(--shadow-color) / 0.14)" />
      {Array.from({ length: coins }, (_, index) => {
        const y = baseY - index * step;
        // Small fixed offsets so the pile looks hand-stacked rather than extruded.
        const x = 80 + [0, 3, -2, 2, -3, 1, -1, 3, -2][index];
        return (
          <g key={index}>
            <path
              d={`M${x - 52} ${y - 12}v12a52 15 0 0 0 104 0v-12Z`}
              fill="var(--mint)"
              stroke="var(--mint-ink)"
              strokeOpacity={0.35}
              strokeWidth={1}
            />
            <ellipse cx={x} cy={y - 12} rx={52} ry={15} fill="#F4EEE0" stroke="#D9CFBA" strokeWidth={1} />
            {index === coins - 1 ? (
              <ellipse cx={x} cy={y - 12} rx={34} ry={9.5} fill="none" stroke="#D9CFBA" strokeWidth={1.5} />
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
