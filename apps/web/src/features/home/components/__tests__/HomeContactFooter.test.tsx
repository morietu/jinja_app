import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeContactFooter, HOME_CONTACT_MAILTO_HREF } from "../HomeContactFooter";

// Mother Ship承認済みの契約。文字列そのものを固定し、
// アドレスや件名が意図せず書き換わることを防ぐ。
const APPROVED_HREF = "mailto:j33db05@gmail.com?subject=KAMI%20MUSUBI%20お問い合わせ";
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

  it("件名にKAMI MUSUBI お問い合わせを含む（デコード後）", () => {
    render(<HomeContactFooter />);

    const href = screen.getByRole("link", { name: "お問い合わせ" }).getAttribute("href") ?? "";
    const url = new URL(href);
    expect(url.pathname).toBe("j33db05@gmail.com");
    expect(url.searchParams.get("subject")).toBe(EXPECTED_SUBJECT);
  });
});
