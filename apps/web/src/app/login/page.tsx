// apps/web/src/app/login/page.tsx
import LoginForm from "./LoginForm";

type SearchParams = Record<string, string | string[] | undefined>;

// ★ Next の生成型に合わせて Promise 前提にする
export type PageProps = {
  searchParams?: Promise<SearchParams>;
};

export default async function Page({ searchParams }: PageProps) {
  // Promise を解決（undefined の可能性も考慮）
  const sp = searchParams ? await searchParams : undefined;

  const raw = sp?.next;
  const next =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  // 内部パスのみ許可（オープンリダイレクト対策）
  const safeNext = next && next.startsWith("/") ? next : "/mypage";

  return <LoginForm next={safeNext} />;
}
