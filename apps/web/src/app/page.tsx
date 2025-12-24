// apps/web/src/app/page.tsx
import HomePage from "@/features/home/HomePage";
import { headers } from "next/headers";

type Goshuin = {
  id: number;
  shrine?: number;
  title?: string | null;
  image_url?: string | null;
  shrine_name?: string | null;
};
type Paginated<T> = { count: number; next: string | null; previous: string | null; results: T[] };

export default async function Page() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/public/goshuins?limit=2&offset=0`, { cache: "no-store" });
  const data: Paginated<Goshuin> | null = res.ok ? await res.json() : null;

  return <HomePage publicGoshuins={data} />;
}
