import type { Shrine } from "@/lib/api/types"; // ← ここに統一

export type ShrineCardAdapterProps = {
  shrineId: number;
  title: string;
  address?: string | null;
  imageUrl?: string | null;
  description: string;
  badges?: string[];
};

function firstNonEmpty(...xs: Array<string | null | undefined>) {
  for (const x of xs) {
    const t = (x ?? "").trim();
    if (t) return t;
  }
  return "";
}

export function buildShrineCardProps(s: Shrine): { cardProps: ShrineCardAdapterProps } {
  const shrineId = s.id;

  const title = firstNonEmpty(s.name_jp, s.name_romaji) || `神社 #${shrineId}`;
  const address = firstNonEmpty(s.address) || null;

  // 画像は現状レスポンスに無いので null でOK（無理に photo_url 読まない）
  const imageUrl = null;

  const description =
    firstNonEmpty(s.goriyaku) ||
    (Array.isArray(s.goriyaku_tags) && s.goriyaku_tags.length
      ? s.goriyaku_tags
          .map((t) => t.name)
          .filter(Boolean)
          .slice(0, 3)
          .join(" / ")
      : "説明は準備中です。");

  const badges = Array.isArray(s.goriyaku_tags) && s.goriyaku_tags.length ? ["ご利益あり"] : [];

  return { cardProps: { shrineId, title, address, imageUrl, description, badges } };
}
