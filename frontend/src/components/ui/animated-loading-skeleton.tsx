"use client";

import { Search } from "lucide-react";
import { motion, useAnimation } from "framer-motion";
import type { TargetAndTransition, Variants } from "framer-motion";
import { useEffect, useMemo, useSyncExternalStore } from "react";

interface GridConfig {
  numCards: number;
  cols: number;
  xBase: number;
  yBase: number;
  xStep: number;
  yStep: number;
}

function getGridConfig(width: number): GridConfig {
  const numCards = 6;
  const cols = width >= 1024 ? 3 : width >= 640 ? 2 : 1;

  return {
    numCards,
    cols,
    xBase: 40,
    yBase: 60,
    xStep: 210,
    yStep: 230,
  };
}

function generateSearchPath(config: GridConfig): TargetAndTransition {
  const { numCards, cols, xBase, yBase, xStep, yStep } = config;
  const rows = Math.ceil(numCards / cols);
  const allPositions = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (row * cols + col < numCards) {
        allPositions.push({
          x: xBase + col * xStep,
          y: yBase + row * yStep,
        });
      }
    }
  }

  const shuffledPositions = allPositions.sort(() => Math.random() - 0.5).slice(0, 4);
  shuffledPositions.push(shuffledPositions[0]);

  return {
    x: shuffledPositions.map((position) => position.x),
    y: shuffledPositions.map((position) => position.y),
    scale: Array<number>(shuffledPositions.length).fill(1.2),
    transition: {
      duration: shuffledPositions.length * 2,
      repeat: Infinity,
      ease: [0.4, 0, 0.2, 1],
      times: shuffledPositions.map((_, index) => index / (shuffledPositions.length - 1)),
    },
  };
}

function subscribeToWindowResize(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function getWindowWidth() {
  return window.innerWidth;
}

function getServerWindowWidth() {
  return 0;
}

export default function AnimatedLoadingSkeleton() {
  const windowWidth = useSyncExternalStore(subscribeToWindowResize, getWindowWidth, getServerWindowWidth);
  const controls = useAnimation();
  const config = useMemo(() => getGridConfig(windowWidth), [windowWidth]);

  useEffect(() => {
    void controls.start(generateSearchPath(config));
  }, [config, controls]);

  const frameVariants: Variants = {
    hidden: { opacity: 0, scale: 0.95 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
  };

  const cardVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: (index: number) => ({
      y: 0,
      opacity: 1,
      transition: { delay: index * 0.1, duration: 0.4 },
    }),
  };

  const glowVariants: Variants = {
    animate: {
      scale: [1, 1.08, 1],
      transition: {
        duration: 1,
        repeat: Infinity,
        ease: "easeInOut",
      },
    },
  };

  return (
    <motion.div
      className="mx-auto w-full max-w-4xl rounded-xl border border-[#F5FEFD]/10 bg-[#202A2D] p-6"
      variants={frameVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="relative overflow-hidden rounded-lg bg-[#1B2326]/48 p-8">
        <motion.div className="pointer-events-none absolute z-10" animate={controls} style={{ left: 24, top: 24 }}>
          <motion.div className="rounded-full border border-[#10F5CC]/20 bg-[#1B2326] p-3" variants={glowVariants} animate="animate">
            <Search className="h-6 w-6 text-[#10F5CC]" aria-hidden="true" />
          </motion.div>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: config.numCards }).map((_, index) => (
            <motion.div
              key={index}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              custom={index}
              whileHover={{ scale: 1.02 }}
              className="rounded-lg border border-[#F5FEFD]/8 bg-[#1B2326] p-4"
            >
              <motion.div
                className="mb-3 h-32 rounded-md bg-[#273538]/90"
                animate={{ background: ["rgba(39,53,56,0.9)", "rgba(245,254,253,0.18)", "rgba(39,53,56,0.9)"] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="mb-2 h-3 w-3/4 rounded bg-[#273538]/90"
                animate={{ background: ["rgba(39,53,56,0.9)", "rgba(245,254,253,0.18)", "rgba(39,53,56,0.9)"] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <motion.div
                className="h-3 w-1/2 rounded bg-[#273538]/90"
                animate={{ background: ["rgba(39,53,56,0.9)", "rgba(245,254,253,0.18)", "rgba(39,53,56,0.9)"] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
