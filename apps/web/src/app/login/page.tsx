// apps/web/src/app/login/page.tsx
import ClientLoginPage from "./ClientLoginPage";

function sanitizeNext(next?: string) {
  if (!next) return "/mypage";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/mypage";
  }
  return next;
}

export default async function Page({
  searchParams,
}: {
  // Next.js 15: searchParams は Promise を await する
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp.next;
  const next = sanitizeNext(Array.isArray(raw) ? raw[0] : raw);
  return <ClientLoginPage next={next} />;
}
