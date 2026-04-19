import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatConfidence(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TSHIRT_SIZES = [
  { label: "XS", fullName: "Extra Small", max: 6 },
  { label: "S",  fullName: "Small",       max: 13 },
  { label: "M",  fullName: "Medium",      max: 39 },
  { label: "L",  fullName: "Large",       max: 78 },
  { label: "XL", fullName: "Extra Large", max: 156 },
  { label: "XXL",fullName: "Extra Extra Large", max: Infinity },
] as const;

export function storyPointsToTShirt(points: number): { label: string; tooltip: string } {
  const size = TSHIRT_SIZES.find((s) => points <= s.max) ?? TSHIRT_SIZES[TSHIRT_SIZES.length - 1];
  return { label: size.label, tooltip: `${size.fullName} · ${points} pts` };
}
