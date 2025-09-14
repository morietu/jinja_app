// apps/web/src/app/mypage/page.tsx
import MyPageView from "./MyPageView";

type SearchParams = {
  tab?: string; // 使うキーだけ定義
};

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const sp = (await searchParams) ?? {};

  // ?tab= の取り出し（なければ undefined）
  const raw = sp.tab;
  const initialTab =
    typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;

  return <MyPageView initialTab={initialTab} />;
}
