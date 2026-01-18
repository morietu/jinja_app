// apps/web/src/components/shrine/buildShrineCardProps.ts
import type { Shrine } from "@/lib/api/shrines";


export type ShrineCardAdapterProps = {
  shrineId: number;
  title: string;
  address?: string | null;
  imageUrl?: string | null; // 使うなら
  description: string; // “短い一言”として固定でOK
  badges?: string[];
};

export function buildShrineCardProps(s: Shrine): { cardProps: ShrineCardAdapterProps } {
  const shrineId = typeof (s as any).id === "number" ? (s as any).id : Number((s as any).id ?? NaN);

  const fallbackTitle = typeof (s as any).name === "string" ? (s as any).name : "";
  const title = (s.name_jp ?? fallbackTitle ?? "").trim() || `神社 #${shrineId}`;
  const address = (s.address ?? "").trim() || null;

  // 画像を ShrineCard で出すなら：最初の1枚だけ
  const imageUrl =
    (s as any).photo_url ?? (Array.isArray((s as any).photos) ? (s as any).photos?.[0]?.url : null) ?? null;

  return {
    cardProps: {
      shrineId,
      title,
      address,
      imageUrl,
      description: "正式に登録されている神社です",
      badges: ["正式登録"],
    },
  };
}
