"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { duration, easeOutSoft } from "@/lib/motion";
import { getDockSlot } from "@/lib/route-metadata";

// Survives template remounts so each page knows which dock slot the user came from.
let previousSlot: number | null = null;

/** Short fade-and-slide between pages; the slide direction follows the dock's slot order. */
export default function DashboardTemplate({ children }: { children: ReactNode }) {
  const slot = getDockSlot(usePathname());
  const direction = previousSlot === null || previousSlot === slot ? 0 : slot > previousSlot ? 1 : -1;

  useEffect(() => {
    previousSlot = slot;
  }, [slot]);

  return (
    <motion.div
      initial={{ opacity: 0, x: direction * 18, y: direction === 0 ? 8 : 0 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: duration.base, ease: easeOutSoft }}
    >
      {children}
    </motion.div>
  );
}
