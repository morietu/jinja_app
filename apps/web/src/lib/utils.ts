import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function pickFirstDefined<T>(a: T | null | undefined, b: T): T {
  if (a !== null && a !== undefined) {
    // a が null / undefined 以外ならそちらを優先
    return a;
  }
  // それ以外はフォールバック b
  return b;
}
export function classifyCount(count: number): "zero" | "one" | "many" {
  if (count === 0) {
    return "zero";
  }
  if (count === 1) {
    return "one";
  }
  return "many";
}
