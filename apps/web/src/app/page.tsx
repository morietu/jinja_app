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

async function pickBaseUrlFromHeaders() {
  const h = await headers(); // ✅ Next 16 は await 必須

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const forwardedProto = h.get("x-forwarded-proto") ?? "http";

  const isLocal = host.includes("localhost") || host.startsWith("127.") || host.startsWith("0.0.0.0");
  const proto = isLocal ? "http" : forwardedProto;

  return `${proto}://${host}`;
}

export default async function Page() {
  const baseUrl = await pickBaseUrlFromHeaders();

  let data: Paginated<Goshuin> | null = null;

  try {
    // ✅ 叩くのは 3000 側（NextのBFF）
    const url = `${baseUrl}/api/public/goshuins?limit=9&offset=0`;
    const res = await fetch(url, { cache: "no-store" });

    if (res.ok) {
      data = (await res.json()) as Paginated<Goshuin>;
    } else {
      console.warn("[top] fetch public goshuins not ok:", res.status, res.statusText, { url });
      data = null;
    }
  } catch (e) {
    console.error("[top] fetch /api/public/goshuins failed:", e, { baseUrl });
    data = null;
  }

  return <HomePage publicGoshuins={data} />;
}
