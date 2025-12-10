import LoginForm from "./LoginForm";

function sanitizeNext(next?: string | null) {
  const fallback = "/mypage?tab=goshuin";

  // next が無い → デフォルトへ
  if (!next) return fallback;

  // 絶対URL など危険な値 → デフォルトへ
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("://")) {
    return fallback;
  }

  // Next.js が付ける _rsc など余計なパラメータを除去
  try {
    const url = new URL(next, "http://dummy");
    url.searchParams.delete("_rsc");

    const cleaned = url.pathname + url.search;
    return cleaned || fallback;
  } catch {
    return fallback;
  }
}

// Next.js 15: searchParams は Promise の可能性があるため await 対応
export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp["next"];
  const next = sanitizeNext(Array.isArray(raw) ? raw[0] : (raw ?? null));
  return <LoginForm next={next} />;
}
