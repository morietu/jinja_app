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
        lat={35.68}
        lng={139.76}
        state="success"
        items={[
          {
            kind: "place",
            place_id: "p1",
            title: "明治神宮",
            subtitle: "東京都渋谷区",
            lat: 35.68,
            lng: 139.76,
            distance_m: 850,
            rating: null,
            user_ratings_total: null,
            icon: null,
          },
          {
            kind: "place",
            place_id: "p2",
            title: "神田明神",
            subtitle: "東京都千代田区",
            lat: 35.695,
            lng: 139.768,
            distance_m: 2300,
            rating: null,
            user_ratings_total: null,
            icon: null,
          },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: "近隣の神社一覧" })).toBeInTheDocument();
    expect(asFragment()).toMatchSnapshot();
  });
});
