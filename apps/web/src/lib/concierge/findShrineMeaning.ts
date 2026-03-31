// apps/web/src/lib/concierge/findShrineMeaning.ts
import { SHRINE_MEANINGS, type ShrineMeaning } from "./shrineMeaning";

function normalizeName(name?: string | null): string {
  return (name ?? "").replace(/\s+/g, "").trim();
}

export function findShrineMeaning(name?: string | null): ShrineMeaning | null {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  for (const item of SHRINE_MEANINGS) {
    if (item.aliases.some((alias) => normalizeName(alias) === normalized)) {
      return item;
    }
  }

  for (const item of SHRINE_MEANINGS) {
    if (item.aliases.some((alias) => normalized.includes(normalizeName(alias)))) {
      return item;
    }
  }

  return null;
}
