// apps/web/src/app/signup/page.tsx
import { redirect } from "next/navigation";
import { sanitizeNext } from "@/lib/nav/login";

function stripRscParam(next: string): string {
  try {
    const url = new URL(next, "http://dummy");
    url.searchParams.delete("_rsc");
    return url.pathname + url.search;
  } catch {
    return next;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp["next"];
  const nextRaw = Array.isArray(raw) ? raw[0] : raw;

  const cleaned = typeof nextRaw === "string" ? stripRscParam(nextRaw) : null;
  const next = sanitizeNext(cleaned);

  if (next) {
    redirect(`/auth/register?returnTo=${encodeURIComponent(next)}`);
  }

  redirect("/auth/register");
}
