import * as React from "react"
import { cn } from "@/lib/utils"

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
  showValue?: boolean
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, showValue = false, ...props }, ref) => {
    let fillColor = "bg-[#059669]" // Emerald (< 80)
    if (value >= 100) {
      fillColor = "bg-[#DC2626]" // Rose (>= 100)
    } else if (value >= 80) {
      fillColor = "bg-[#D97706]" // Amber (< 100)
    }

    return (
      <div className={cn("w-full flex flex-col gap-1.5", className)} ref={ref} {...props}>
        {showValue && (
          <div className="text-[#6E6D7A] text-[10px] font-mono">
            {Math.round(value)}%
          </div>
        )}
        <div className="bg-[#E8E6E1] h-1.5 rounded-full overflow-hidden w-full">
          <div
            className={cn("h-full transition-all duration-300 ease-in-out", fillColor)}
            style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
          />
        </div>
      </div>
    )
  }
)
Progress.displayName = "Progress"

export { Progress }
