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

async function pickBaseUrl() {
  const h = await headers(); // ✅ ここを await

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const forwardedProto = h.get("x-forwarded-proto") ?? "http";

  const isLocal = host.includes("localhost") || host.startsWith("127.0.0.1") || host.startsWith("0.0.0.0");

  const proto = isLocal ? "http" : forwardedProto;
  return `${proto}://${host}`;
}

export default async function Page() {
  const baseUrl = await pickBaseUrl(); // ✅ await

  let data: Paginated<Goshuin> | null = null;

  try {
    const res = await fetch(`${baseUrl}/api/public/goshuins?limit=9&offset=0`, { cache: "no-store" });
    if (res.ok) data = (await res.json()) as Paginated<Goshuin>;
  } catch (e) {
    console.error("[top] fetch /api/public/goshuins failed:", e, { baseUrl });
    data = null;
  }

  return <HomePage publicGoshuins={data} />;
}
