import * as React from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface ActionMenuItem {
  label: string
  shortcut?: string
  destructive?: boolean
  onClick: () => void
}

export interface ActionMenuProps {
  items: ActionMenuItem[]
}

export function ActionMenu({ items }: ActionMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="bg-transparent hover:bg-paper-sunk p-1.5 min-h-11 min-w-11 md:min-h-0 md:min-w-0 rounded-md transition-colors focus:outline-none flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4 text-ink" />
          <span className="sr-only">Open menu</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {items.map((item, index) => (
          <DropdownMenuItem
            key={index}
            onClick={item.onClick}
            className={cn(
              "text-sm flex justify-between items-center cursor-pointer transition-colors",
              item.destructive
                ? "text-negative focus:text-negative focus:bg-negative-soft hover:bg-negative-soft"
                : "text-ink focus:bg-paper hover:bg-paper"
            )}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-xs text-ink-soft">
                {item.shortcut}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
