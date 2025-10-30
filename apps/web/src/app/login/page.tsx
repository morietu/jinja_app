// apps/web/src/app/login/page.tsx
import LoginForm from "./LoginForm";

// ※このファイルは Server Component（"use client" は付けない）
type SearchParams = { [key: string]: string | string[] | undefined };

function sanitizeNext(next?: string) {
  // 内部遷移のみ許可（open redirect防止）
  if (!next) return "/mypage?tab=goshuin";
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return "/mypage?tab=goshuin";
  }
  return next;
}

export default function Page({ searchParams }: { searchParams?: SearchParams }) {
  const raw = searchParams?.next;
  const nextRaw = Array.isArray(raw) ? raw[0] : raw;
  const next = sanitizeNext(nextRaw); // /login ループや外部URLを排除
  return <LoginForm next={next} />;
}
