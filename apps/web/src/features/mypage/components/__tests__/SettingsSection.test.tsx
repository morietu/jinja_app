import { render, screen, fireEvent } from "@testing-library/react";
import SettingsSection from "../SettingsSection";
import * as mypageApi from "@/lib/api/mypage";

vi.mock("@/lib/api/mypage");

describe("SettingsSection", () => {
  it("初期表示で公開状態を表示する", () => {
    render(<SettingsSection initialIsPublic={true} />);
    expect(screen.getByText("公開プロフィール")).toBeInTheDocument();
    expect(screen.getByText("公開中")).toBeInTheDocument();
  });

  it("トグルで updateProfileVisibility が呼ばれる", async () => {
    const spy = vi.spyOn(mypageApi, "updateProfileVisibility").mockResolvedValue();

    render(<SettingsSection initialIsPublic={false} />);

    const button = screen.getByRole("button", { name: /非公開/ });
    await fireEvent.click(button);

    expect(spy).toHaveBeenCalledWith(true);
  });
});
