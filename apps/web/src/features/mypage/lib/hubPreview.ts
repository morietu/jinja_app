// apps/web/src/features/mypage/lib/hubPreview.ts
//
// /mypage HUBのpreview表示に必要な純関数だけを置く。
// Ranking / Popular / Recommendationとは無関係で、HUBの表示順・表示件数のみを扱う。

import type { Favorite } from "@/lib/api/favorites";
import type { AuthUser } from "@/lib/auth/types";

/** HUBの各sectionで表示するpreviewの最大件数。 */
export const HUB_PREVIEW_LIMIT = 3;

/**
 * HUBのアカウント概要に出す表示名。
 * profile.nicknameを正本とし、無ければusernameへfallbackする
 * （UserMeSerializerにtop-levelのnicknameは存在しないため、user.nicknameは参照しない）。
 */
export function resolveDisplayName(user: AuthUser | null | undefined): string {
  const nickname = (user?.profile?.nickname ?? "").trim();
  if (nickname) return nickname;

  const username = (user?.username ?? "").trim();
  if (username) return username;

  return "ユーザー";
}

function toTime(value?: string | null): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

/**
 * HUBの「保存した神社」previewの表示順。
 * Favorite.created_at の降順（最近保存した順）。公開御朱印数は考慮しない。
 * Mypage preview限定の表示順であり、Ranking / Popular logicではない。
 */
export function sortFavoritesByRecentlySaved(favorites: Favorite[]): Favorite[] {
  return [...favorites].sort((a, b) => toTime(b.created_at) - toTime(a.created_at));
}

/**
 * previewへ渡す件数へ切り詰める。並び替えはしない
 * （相談履歴はBackendの順序 -last_message_at, -id をそのまま使う）。
 */
export function takeHubPreview<T>(items: T[], limit: number = HUB_PREVIEW_LIMIT): T[] {
  return items.slice(0, limit);
}
