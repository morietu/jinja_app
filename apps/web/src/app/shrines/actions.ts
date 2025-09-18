"use server";

export type CreateShrineInput = {
  name_jp: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  goriyaku: string;
  sajin: string;
  goriyakuTagIds: number[]; // ← フロントはこれで統一
};

export async function createShrine(input: CreateShrineInput) {
  // REST バックエンドに合わせて、必要ならフィールド名を変換
  // 例）Django 側が goriyaku_tags（ID配列）を受けるなら以下のように変換
  const payload = {
    name_jp: input.name_jp,
    address: input.address ?? "",
    latitude: input.latitude,
    longitude: input.longitude,
    goriyaku: input.goriyaku ?? null,
    sajin: input.sajin ?? null,
    // ← バックエンドの期待に合わせる。以下のどちらかを使う:
    goriyaku_tags: input.goriyakuTagIds,   // Django 側が goriyaku_tags の場合
    // goriyakuTagIds: input.goriyakuTagIds // もしサーバも camelCase ならこちら
  };

  const base = process.env.API_BASE_URL ?? "http://localhost:8000/api";
  const res = await apiFetch(`shrines/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // 認証が必要なら Cookie/Authorization をここで付与
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to create shrine: ${res.status} ${text}`);
  }

  return res.json(); // { id, ... } が返る想定
}
