// apps/web/src/features/home/components/HomeContactFooter.tsx
//
// Home最下部の最小の連絡導線。beta利用者がメールで連絡できる経路だけを置く。
// 問い合わせフォームやAPI/バックエンドは作らず、mailto: のリンク1本に留める。
//
// 従属性の担保:
//   - スティッキーにしない（本文の最後に一度だけ現れる）
//   - 主要導線(相談CTA / 補助導線グリッド)の後ろに置く
//   - goldは使わず、文字サイズと彩度を落として面も持たせない
// 色は既存のDark Forest Semantic Tokenのみを使い、新規Tokenは追加しない。

/** Mother Ship承認済みの問い合わせ先。 */
export const HOME_CONTACT_EMAIL = "j33db05@gmail.com";

/** 件名のデコード後の値。 */
export const HOME_CONTACT_SUBJECT = "KAMI MUSUBI お問い合わせ";

/**
 * 問い合わせ用の mailto href。
 *
 * クエリ値は UTF-8 の完全な percent-encode とする。日本語を生のまま
 * 置くと、URLの解釈がクライアント任せになり件名が化ける環境が出るため、
 * 手書きせず encodeURIComponent で構築して取りこぼしを防ぐ。
 *
 * 実際に生成される文字列（契約値。テストで固定している）:
 *   mailto:j33db05@gmail.com?subject=KAMI%20MUSUBI%20%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B
 */
export const HOME_CONTACT_MAILTO_HREF = `mailto:${HOME_CONTACT_EMAIL}?subject=${encodeURIComponent(
  HOME_CONTACT_SUBJECT,
)}`;

export function HomeContactFooter() {
  return (
    <footer className="mt-14 border-t border-[var(--kt-color-border-default)] pt-6">
      <a
        href={HOME_CONTACT_MAILTO_HREF}
        className="text-xs text-[var(--kt-color-text-secondary)] underline-offset-4 transition hover:text-[var(--kt-color-text-primary)] hover:underline"
      >
        お問い合わせ
      </a>
    </footer>
  );
}
