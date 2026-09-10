import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeContactFooter, HOME_CONTACT_MAILTO_HREF } from "../HomeContactFooter";

// Mother Ship承認済みの契約。文字列そのものを固定し、
// アドレスや件名が意図せず書き換わることを防ぐ。
//
// クエリ値は UTF-8 の完全な percent-encode。実装側は encodeURIComponent で
// 構築しているが、テストは生成結果に依存せず「あるべき文字列」を直接
// 書き下すことで、エンコード方法を変えても契約が崩れないようにする。
const APPROVED_HREF =
  "mailto:j33db05@gmail.com?subject=KAMI%20MUSUBI%20%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B";
const EXPECTED_SUBJECT = "KAMI MUSUBI お問い合わせ";

describe("HomeContactFooter", () => {
  it("お問い合わせリンクを表示する", () => {
    render(<HomeContactFooter />);

    expect(screen.getByRole("link", { name: "お問い合わせ" })).toBeInTheDocument();
  });

  it("hrefがmailto:スキームである", () => {
    render(<HomeContactFooter />);

    const href = screen.getByRole("link", { name: "お問い合わせ" }).getAttribute("href") ?? "";
    expect(href.startsWith("mailto:")).toBe(true);
    expect(new URL(href).protocol).toBe("mailto:");
  });

  it("承認された宛先と件名の契約に一致する", () => {
    render(<HomeContactFooter />);

    const href = screen.getByRole("link", { name: "お問い合わせ" }).getAttribute("href");
    expect(href).toBe(APPROVED_HREF);
    expect(HOME_CONTACT_MAILTO_HREF).toBe(APPROVED_HREF);
  });

  it("hrefにASCII外の文字を含まない（完全にpercent-encodeされている）", () => {
    render(<HomeContactFooter />);

    const href = screen.getByRole("link", { name: "お問い合わせ" }).getAttribute("href") ?? "";
    // 生の日本語が残っていると、URL解釈がクライアント任せになり件名が化ける。
    // 失敗時に該当文字が見えるよう、正規表現ではなく差分として表明する。
    const nonAscii = [...href].filter((ch) => ch.charCodeAt(0) > 0x7f);
    expect(nonAscii).toEqual([]);
    expect(href).toContain("%E3%81%8A"); // 「お」
  });

  it("件名にKAMI MUSUBI お問い合わせを含む（デコード後）", () => {
    render(<HomeContactFooter />);

    const href = screen.getByRole("link", { name: "お問い合わせ" }).getAttribute("href") ?? "";
    const url = new URL(href);
    expect(url.pathname).toBe("j33db05@gmail.com");
    expect(url.searchParams.get("subject")).toBe(EXPECTED_SUBJECT);
  });
});
