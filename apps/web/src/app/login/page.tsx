// apps/web/src/app/login/page.tsx
import LoginForm from "./LoginForm";

function sanitizeNext(next?: string | null) {
  if (!next) return "/mypage";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/mypage";
  }
  return next;
}

// Next.js 15: searchParams は Promise の可能性があるため await 対応
export default async function Page({
  searchParams,
}: {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp["next"];
  const next = sanitizeNext(Array.isArray(raw) ? raw[0] : raw ?? null);
  return <LoginForm next={next} />;
}
