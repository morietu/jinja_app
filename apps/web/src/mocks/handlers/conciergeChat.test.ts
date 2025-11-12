// ざっくりイメージ。実際の MSW テスト構成に合わせて調整。
import { describe, it, expect } from "vitest";
import { postConciergeChat } from "@/features/concierge/api";

describe("postConciergeChat", () => {
  it("calls /api/concierge/chat/ and parses reply", async () => {
    const { status, body } = await postConciergeChat({ message: "ping" });

    expect(status).toBe(200);
    expect("ok" in body && body.ok).toBe(true);
  });
});
