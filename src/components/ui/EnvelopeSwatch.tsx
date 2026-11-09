import {
  Baby,
  Bus,
  Car,
  Coffee,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PawPrint,
  PiggyBank,
  Plane,
  Receipt,
  Shield,
  Shirt,
  ShoppingCart,
  Smartphone,
  Utensils,
  Wifi,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { EnvelopeIcon } from "@/lib/types";

export const ENVELOPE_ICON_COMPONENTS: Record<EnvelopeIcon, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  coffee: Coffee,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  home: House,
  zap: Zap,
  wifi: Wifi,
  smartphone: Smartphone,
  receipt: Receipt,
  "heart-pulse": HeartPulse,
  shield: Shield,
  "graduation-cap": GraduationCap,
  baby: Baby,
  "paw-print": PawPrint,
  shirt: Shirt,
  gift: Gift,
  film: Film,
  gamepad: Gamepad2,
  dumbbell: Dumbbell,
  plane: Plane,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
};

/** Spoken names for the icon picker. */
export const ENVELOPE_ICON_LABELS: Record<EnvelopeIcon, string> = {
  utensils: "Food",
  "shopping-cart": "Groceries",
  coffee: "Coffee",
  car: "Car",
  fuel: "Fuel",
  bus: "Public transport",
  home: "Home",
  zap: "Electricity",
  wifi: "Internet",
  smartphone: "Phone",
  receipt: "Bills",
  "heart-pulse": "Health",
  shield: "Insurance",
  "graduation-cap": "Education",
  baby: "Kids",
  "paw-print": "Pets",
  shirt: "Clothes",
  gift: "Gifts",
  film: "Entertainment",
  gamepad: "Games",
  dumbbell: "Fitness",
  plane: "Travel",
  "piggy-bank": "Savings",
  landmark: "Bank",
};

/**
 * An envelope's mark: a colour dot, or, when the envelope has an icon, the icon on a soft tint of its colour.
 * Decorative (the name always sits beside it). The icon is drawn in foreground for contrast on any colour.
 */
export function EnvelopeSwatch({ colour, icon, className }: { colour: string | null; icon?: EnvelopeIcon | null; className?: string }) {
  if (icon) {
    const Icon = ENVELOPE_ICON_COMPONENTS[icon];
    const c = colour ?? "var(--muted-foreground)";
    return (
      <span
        aria-hidden="true"
        className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full text-foreground", className)}
        style={{ backgroundColor: `color-mix(in srgb, ${c} 24%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${c}` }}
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn("inline-block size-3 shrink-0 rounded-full", !colour && "bg-muted-foreground", className)}
      style={colour ? { backgroundColor: colour } : undefined}
    />
  );
}
