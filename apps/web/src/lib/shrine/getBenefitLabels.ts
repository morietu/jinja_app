// apps/web/src/lib/shrine/getBenefitLabels.ts
import type { Shrine } from "@/lib/api/shrines";

/**
 * Shrineのご利益情報から表示用のラベル配列を作る
 */
export function getBenefitLabels(shrine: Shrine): string[] {
  if (Array.isArray(shrine.goriyaku_tags) && shrine.goriyaku_tags.length > 0) {
    return shrine.goriyaku_tags.map((t) => t?.name?.trim()).filter((name): name is string => Boolean(name));
  }

  if (typeof shrine.goriyaku === "string" && shrine.goriyaku.trim().length > 0) {
    return shrine.goriyaku
      .split(/[、,／/]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return [];
}
