// apps/web/src/app/login/page.tsx
import ClientLoginPage from "./ClientLoginPage";

function sanitizeNext(next?: string) {
  // 内部URLのみ許可（open redirect対策）
  if (!next) return "/mypage";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/mypage";
  }
  return next;
}

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const raw = searchParams?.next;
  const nextRaw = Array.isArray(raw) ? raw[0] : raw;
  const next = sanitizeNext(nextRaw);

  return <ClientLoginPage next={next} />;
}
