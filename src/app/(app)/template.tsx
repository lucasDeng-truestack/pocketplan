"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { NAV_ITEMS, isNavActive } from "@/components/BottomNav";

// Where the previous page sat in the tab order; the template remounts per navigation, so this lives outside it.
let lastIndex = -1;

/**
 * Remounts on every navigation inside the app. There is no loading.tsx, so the current page stays up while the
 * next one loads behind the scenes; when it is ready it slides in from the side of the tab you moved towards.
 * Small offset and no bounce on purpose (motion sickness). The transform ends at none, so it never becomes the
 * containing block for a page's fixed sheets after the entrance.
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const index = NAV_ITEMS.findIndex((item) => isNavActive(item, pathname));
  // Read once on mount (this template remounts per navigation); written back after render, never during it.
  const [dir] = useState(() => (lastIndex === -1 || index === -1 || index === lastIndex ? 0 : index > lastIndex ? 1 : -1));
  useEffect(() => {
    lastIndex = index;
  }, [index]);
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, x: dir * 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}
