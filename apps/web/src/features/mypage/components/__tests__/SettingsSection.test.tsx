// apps/web/src/features/mypage/components/__tests__/SettingsSection.test.tsx
import { render, screen } from "@testing-library/react";
import React from "react";
import SettingsSection from "../SettingsSection";

describe("SettingsSection", () => {
  const baseUser = {
    username: "test-user",
    profile: {
      is_public: true,
    },
  };

  it("プロフィール編集リンクを表示する", () => {
    render(<SettingsSection user={baseUser} />);

    const link = screen.getByRole("link", { name: "プロフィールを編集する" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/mypage/edit");
  });

  it("公開中ユーザーには公開プロフィールページへのリンクを表示する", () => {
    render(<SettingsSection user={baseUser} />);

    expect(screen.getByText("公開プロフィールページ")).toBeInTheDocument();
    // /users/test-user へのリンクが出ていること
    const publicLink = screen.getByRole("link", { name: "/users/test-user" });
    expect(publicLink).toBeInTheDocument();
    expect(publicLink).toHaveAttribute("href", "/users/test-user");
  });

  it("非公開ユーザーには公開プロフィールページへのリンクを表示しない", () => {
    const privateUser = {
      ...baseUser,
      profile: {
        is_public: false,
      },
    };

    render(<SettingsSection user={privateUser} />);

    expect(screen.queryByText("公開プロフィールページ")).not.toBeInTheDocument();
  });
});
