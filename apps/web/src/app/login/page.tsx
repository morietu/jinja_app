// apps/web/src/app/login/page.tsx
import LoginForm from "./LoginForm";

type SearchParams = Record<string, string | string[] | undefined>;

export type PageProps = {
  searchParams?: SearchParams; // ← Promise ではない
};

export default function Page({ searchParams }: PageProps) {
  const raw = searchParams?.next;
  const next = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  // 内部パスのみ許可（オープンリダイレクト対策）
  // 1) 先頭が "/" である
  // 2) 先頭が "//"（プロトコル相対）ではない
  // 3) "://" を含まない（明示的にスキーム指定を排除）
  const isInternal =
    !!next &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.includes("://");

  const safeNext = isInternal ? next : "/mypage";

  return <LoginForm next={safeNext} />;
}
