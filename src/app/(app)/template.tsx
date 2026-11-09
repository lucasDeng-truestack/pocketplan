"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, isNavActive } from "@/components/BottomNav";

// Where the previous page sat in the tab order; the template remounts per navigation, so this lives outside it.
let lastIndex = -1;

/**
 * Remounts on every navigation inside the app. There is no loading.tsx, so the current page stays up while the
 * next one loads behind the scenes; when it is ready it slides in from the side of the tab you moved towards.
 * Small offset and no bounce on purpose (motion sickness). The animation is the CSS `page-in` utility (globals.css).
 */
export default function AppTemplate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const index = NAV_ITEMS.findIndex((item) => isNavActive(item, pathname));
  // Read once on mount (this template remounts per navigation); written back after render, never during it.
  const [dir] = useState(() => (lastIndex === -1 || index === -1 || index === lastIndex ? 0 : index > lastIndex ? 1 : -1));
  useEffect(() => {
    lastIndex = index;
  }, [index]);
  return (
    <div className="page-in" style={{ "--page-dx": `${dir * 16}px` } as CSSProperties}>
      {children}
    </div>
  );
}
