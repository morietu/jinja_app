// apps/web/src/components/nearby/__tests__/NearbyList.item.test.tsx
import { render, screen } from "@testing-library/react";
import { NearbyListItem } from "../NearbyList.Item"; // ← nearby配下でOK

describe("NearbyListItem", () => {
  it("shows distance only", () => {
    render(<NearbyListItem id="1" name="A" distanceMeters={120} />);
    // DOMは「120 m」なので \s? を入れる
    expect(screen.getByText(/120\s?m/)).toBeInTheDocument();
    // 代替：aria-labelでも確認可能（堅牢）
    expect(screen.getByLabelText(/距離\s*120\s*m/)).toBeInTheDocument();
  });

  it("shows address and duration when provided", () => {
    render(
      <NearbyListItem
        id="2"
        name="明治神宮"
        distanceMeters={2300}
        durationMinutes={28}
        address="東京都渋谷区"
      />
    );
    expect(screen.getByText("東京都渋谷区")).toBeInTheDocument();
    expect(screen.getByText(/2\.3\s?km/)).toBeInTheDocument();
    expect(screen.getByText(/28\s?分/)).toBeInTheDocument();
    // aria-label 側でも二重に確認
    expect(screen.getByLabelText(/所要\s*28\s*分/)).toBeInTheDocument();
  });
});
