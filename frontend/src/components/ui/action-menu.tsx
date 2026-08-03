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
        <button className="bg-transparent hover:bg-[#F0EEE9] p-1.5 rounded-md transition-colors focus:outline-none flex items-center justify-center">
          <MoreHorizontal className="w-4 h-4 text-[#1A1A1A]" />
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
                ? "text-[#B91C1C] focus:text-[#B91C1C] focus:bg-[#FEF2F2] hover:bg-[#FEF2F2]"
                : "text-[#1A1A1A] focus:bg-[#F9F8F5] hover:bg-[#F9F8F5]"
            )}
          >
            <span>{item.label}</span>
            {item.shortcut && (
              <span className="ml-4 text-[10px] text-[#6E6D7A]">
                {item.shortcut}
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
