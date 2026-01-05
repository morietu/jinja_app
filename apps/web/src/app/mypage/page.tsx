// apps/web/src/app/mypage/page.tsx
import MyPageView from "@/components/views/MyPageView";
import { getFavoritesServer } from "@/lib/api/favorites.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MyPagePage() {
  const favorites = await getFavoritesServer();
  return <MyPageView initialFavorites={favorites} />;
}
