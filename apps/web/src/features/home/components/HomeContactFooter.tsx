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

/**
 * Mother Ship承認済みの問い合わせ先。
 * 件名は承認された契約文字列をそのまま用いる（空白は %20、日本語はそのまま）。
 */
export const HOME_CONTACT_MAILTO_HREF =
  "mailto:j33db05@gmail.com?subject=KAMI%20MUSUBI%20お問い合わせ";

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
