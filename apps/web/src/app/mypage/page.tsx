// apps/web/src/app/mypage/page.tsx
import MyPageView from "@/components/views/MyPageView";
import { getFavoritesServer } from "@/lib/api/favorites.server";
import { getConciergeThreadsServer } from "@/lib/api/concierge.server";
import { getBillingStatusServer } from "@/lib/api/billing.server";
import type { Favorite } from "@/lib/api/favorites";
import type { ConciergeThread } from "@/lib/api/concierge/types";
import type { BillingStatus } from "@/lib/api/billing";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type SectionResult<T> = { data: T; fetchFailed: boolean };

/** section単位のfail-safe。1つのsectionの失敗でHUB全体を落とさない。 */
async function loadSection<T>(load: () => Promise<T>, fallback: T): Promise<SectionResult<T>> {
  try {
    return { data: await load(), fetchFailed: false };
  } catch {
    return { data: fallback, fetchFailed: true };
  }
}

export default async function MyPagePage() {
  const [favorites, threads, billingStatus] = await Promise.all([
    loadSection<Favorite[]>(getFavoritesServer, []),
    loadSection<ConciergeThread[]>(getConciergeThreadsServer, []),
    // getBillingStatusServer()は内部で握り潰してFREEへfallbackするため、ここでは素通し。
    getBillingStatusServer() as Promise<BillingStatus>,
  ]);

  return (
    <MyPageView
      favorites={favorites.data}
      favoritesFetchFailed={favorites.fetchFailed}
      threads={threads.data}
      threadsFetchFailed={threads.fetchFailed}
      billingStatus={billingStatus}
    />
  );
}
