// apps/web/src/features/mypage/components/__tests__/GoshuinUploadForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GoshuinUploadForm from "../GoshuinUploadForm";
import { uploadMyGoshuin } from "@/lib/api/goshuin";

vi.mock("@/lib/api/goshuin", () => ({
  uploadMyGoshuin: vi.fn(),
}));

describe("GoshuinUploadForm", () => {
  it("正常アップロード時に API が呼ばれ、成功メッセージが表示される", async () => {
    (uploadMyGoshuin as any).mockResolvedValue({
      id: 1,
      shrine: 1,
      is_public: true,
      image_url: "/test.png",
      created_at: new Date().toISOString(),
    });

    const onUploaded = vi.fn();
    render(<GoshuinUploadForm onUploaded={onUploaded} />);

    const file = new File(["dummy"], "test.png", { type: "image/png" });
    const input = screen.getByLabelText("御朱印画像") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const button = screen.getByRole("button", { name: "アップロード" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(uploadMyGoshuin).toHaveBeenCalledTimes(1);
      expect(onUploaded).toHaveBeenCalledTimes(1);
      expect(screen.getByText("御朱印をアップロードしました。")).toBeInTheDocument();
    });
  });

  it("画像以外のファイルを選ぶとエラーが表示される", () => {
    render(<GoshuinUploadForm />);

    const file = new File(["dummy"], "test.txt", { type: "text/plain" });
    const input = screen.getByLabelText("御朱印画像") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const button = screen.getByRole("button", { name: "アップロード" });
    fireEvent.click(button);

    expect(screen.getByText("画像ファイルのみアップロードできます。")).toBeInTheDocument();
  });

  it("5MB超過のファイルを選ぶとエラーが表示される", () => {
    render(<GoshuinUploadForm />);

    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" });
    const input = screen.getByLabelText("御朱印画像") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [bigFile] } });

    const button = screen.getByRole("button", { name: "アップロード" });
    fireEvent.click(button);

    expect(screen.getByText("ファイルサイズは 5MB 以下を推奨しています。")).toBeInTheDocument();
  });
});
