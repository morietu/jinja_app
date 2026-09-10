import "server-only";

import { cookies } from "next/headers";

import type { ShrineMeaningPayloadV2 } from "@/lib/shrineMeaning/payloadV2";
import { isShrineMeaningPayloadV2 } from "@/lib/api/shrineMeaning";
import { resolveServerBaseUrl } from "@/lib/server/resolveServerBaseUrl";

/**
 * Server-side reader for ShrineMeaningPayloadV2.
 *
 * 方針:
 * - Server Component から Next.js BFF を経由して取得する
 * - 現在の request Cookie を BFF へ引き継ぐ
 * - Premium / Free 判定は Backend を正本とする
 * - 取得失敗時は null を返し、詳細画面では既存 fallback を維持する
 */
export async function fetchShrineMeaningPayloadV2Server(
  shrineId: number,
): Promise<ShrineMeaningPayloadV2 | null> {
  if (!Number.isFinite(shrineId) || shrineId <= 0) {
    return null;
  }

  try {
    const base = await resolveServerBaseUrl();

    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();

    const url = `${base}/api/shrines/${encodeURIComponent(
      String(shrineId),
    )}/meaning/`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = (await res.json()) as unknown;

    return isShrineMeaningPayloadV2(data) ? data : null;
  } catch {
    return null;
  }
}
