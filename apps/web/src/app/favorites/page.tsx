// apps/web/src/app/favorites/page.tsx
import FavoritesListClient from "./FavoritesListClient";
import { getFavoritesServer } from "@/lib/api/favorites.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FavoritesPage() {
  const favorites = await getFavoritesServer();
  

  return (
    <main className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">お気に入り</h1>
      </header>

      <FavoritesListClient initialFavorites={favorites} />
    </main>
  );
}
