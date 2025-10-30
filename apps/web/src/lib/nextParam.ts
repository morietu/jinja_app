// apps/web/src/lib/nextParam.ts
/**
 * /login の無限自己参照や外部URLを避けるための next パラメータサニタイズ
 * - 先頭 "/" の相対パスだけ許可
 * - /login で始まるものは禁止（デフォルトにフォールバック）
 * - うまく解釈できない文字列もフォールバック
 */
export function sanitizeNext(raw: string | null | undefined) {
  const fallback = "/mypage?tab=goshuin";
  if (!raw) return fallback;

  // 絶対URL or 相対URLっぽい文字列を正規化して path+search を取り出す
  try {
    // 第二引数のダミーは絶対URL化するためだけに使う
    const u = new URL(raw, "http://local.invalid");
    const path = u.pathname + (u.search || "");
    if (!path.startsWith("/")) return fallback;
    if (path.startsWith("/login")) return fallback;
    return path;
  } catch {
    // URL として解釈できない場合：単純チェック
    if (!raw.startsWith("/")) return fallback;
    if (raw.startsWith("/login")) return fallback;
    return raw;
  }
}
