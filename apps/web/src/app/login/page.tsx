// apps/web/src/app/login/page.tsx
import LoginForm from "./LoginForm";

type SearchParams = Record<string, string | string[] | undefined>;

export type PageProps = {
  searchParams: Promise<SearchParams>; // ← Promise にする
};

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams;      // ← await が必須
  const raw = sp?.next;
  const next = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  const isInternal =
    !!next && next.startsWith("/") && !next.startsWith("//") && !next.includes("://");
  const safeNext = isInternal ? next : "/mypage";

  return <LoginForm next={safeNext} />;
}
