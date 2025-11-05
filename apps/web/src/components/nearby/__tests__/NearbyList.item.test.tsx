// apps/web/src/components/nearby/__tests__/NearbyList.item.test.tsx
import { NearbyListItem } from "../NearbyList.Item";
import { render, screen, fireEvent } from "@testing-library/react";

describe("NearbyListItem", () => {
  it("shows distance only", () => {
    render(
      <NearbyListItem
        id="1"
        name="明治神宮"
        distanceMeters={1200}
        durationMinutes={15}
        address="東京都渋谷区"
      />
    );

    expect(screen.getByText("明治神宮")).toBeInTheDocument();
    expect(screen.getByText("東京都渋谷区")).toBeInTheDocument();
    // 1000m以上はkm表記になる（1.2 km）
    expect(screen.getByText(/1\.2\s?km/)).toBeInTheDocument();
    // a11yラベルもkm表記
    expect(
      screen.getByRole("listitem", { name: /距離\s*1\.2\s*km/ })
    ).toBeInTheDocument();
    const timeEl = screen.getByLabelText("徒歩所要時間");
    expect(timeEl).toHaveTextContent(/所要\s*15\s*分/);
  });

  it("triggers onClick when clicked", () => {
    const onClick = vi.fn();
    render(
      <NearbyListItem
        id="1"
        name="明治神宮"
        distanceMeters={1200}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole("listitem"));
    expect(onClick).toHaveBeenCalledWith("1");
  });

  it("shows address and duration when provided", () => {
    render(
      <NearbyListItem
        id="2"
        name="神田明神"
        distanceMeters={2300}
        durationMinutes={28}
        address="東京都千代田区"
      />
    );
    expect(screen.getByText("東京都千代田区")).toBeInTheDocument();
    expect(screen.getByText(/2\.3\s?km/)).toBeInTheDocument();
    expect(screen.getByText(/28\s?分/)).toBeInTheDocument();
    expect(screen.getByLabelText(/所要\s*28\s*分/)).toBeInTheDocument();
  });

  it("formats distance in meters under 1000m", () => {
    render(<NearbyListItem id="m1" name="近所の神社" distanceMeters={120} />);
    expect(screen.getByText("120 m")).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: /距離\s*120\s*m/ })
    ).toBeInTheDocument();
  });

  // キーボード操作（Enter / Space）でも onClick が呼ばれる
  it("triggers onClick with keyboard (Enter/Space)", () => {
    const onClick = vi.fn();
    render(
      <NearbyListItem
        id="k1"
        name="明治神宮"
        distanceMeters={1200}
        onClick={onClick}
      />
    );

    const li = screen.getByRole("listitem");
    li.focus();
    fireEvent.keyDown(li, { key: "Enter" });
    fireEvent.keyDown(li, { key: " " }); // Space
    expect(onClick).toHaveBeenCalledTimes(2);
    expect(onClick).toHaveBeenCalledWith("k1");
  });
});
