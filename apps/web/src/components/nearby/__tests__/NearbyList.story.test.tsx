import { render, screen } from "@testing-library/react";
import { NearbyList } from "../../nearby/NearbyList";

describe("NearbyList stories parity", () => {
  test("Loading snapshot", () => {
    const { asFragment } = render(<NearbyList lat={0} lng={0} state="loading" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Empty snapshot", () => {
    const { asFragment } = render(<NearbyList lat={0} lng={0} state="empty" />);
    expect(screen.getByText("見つかりませんでした")).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Error snapshot", () => {
    const { asFragment } = render(<NearbyList lat={0} lng={0} state="error" errorMessage="ネットワークエラー" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });

  test("Success snapshot", () => {
    const { asFragment } = render(
      <NearbyList
        lat={35.68} lng={139.76} state="success"
        items={[
          { id: "1", name: "明治神宮", distanceMeters: 850, durationMinutes: 12, address: "東京都渋谷区" },
          { id: "2", name: "神田明神", distanceMeters: 2300, durationMinutes: 28, address: "東京都千代田区" },
        ]}
      />
    );
    expect(screen.getByRole("list", { name: "近隣の神社一覧" })).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
