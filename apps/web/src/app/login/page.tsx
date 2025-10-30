// apps/web/src/app/login/page.tsx
import LoginForm from "./LoginForm";
import { sanitizeNext } from "@/lib/nextParam";

// ※このファイルは Server Component（"use client" を付けない）
export default function Page({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.next;
  const nextRaw = Array.isArray(raw) ? raw[0] : raw;
  const next = sanitizeNext(nextRaw); // /loginループや外部URLを排除

  return <LoginForm next={next} />;
}
