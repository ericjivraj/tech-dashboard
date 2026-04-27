import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatConfidence(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TSHIRT_SIZES = [
  { label: "Day",           fullName: "Day",           max: 6 },
  { label: "Days",          fullName: "Days",          max: 13 },
  { label: "Week",          fullName: "Week",          max: 39 },
  { label: "Weeks",         fullName: "Weeks",         max: 78 },
  { label: "Several Weeks", fullName: "Several Weeks", max: 156 },
  { label: "Months",        fullName: "Months",        max: Infinity },
] as const;

export function storyPointsToTShirt(points: number): { label: string; tooltip: string } {
  const size = TSHIRT_SIZES.find((s) => points <= s.max) ?? TSHIRT_SIZES[TSHIRT_SIZES.length - 1];
  return { label: size.label, tooltip: `${size.fullName} · ${points} pts` };
}
