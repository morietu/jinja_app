/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NearbyList } from "@/components/nearby/NearbyList";
import type { NearbyItem } from "@/components/nearby/types";

describe("NearbyList", () => {
  it("shows loading skeleton", () => {
    render(<NearbyList lat={0} lng={0} state="loading" />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows empty", () => {
    render(<NearbyList lat={0} lng={0} state="empty" />);
    expect(screen.getByText("見つかりませんでした")).toBeInTheDocument();
  });

  it("shows error", () => {
    render(<NearbyList lat={0} lng={0} state="error" errorMessage="boom" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("shows items", () => {
    render(
      <NearbyList
        lat={0}
        lng={0}
        state="success"
        items={[
          {
            kind: "place",
            place_id: "p1",
            title: "A",
            subtitle: undefined,
            lat: 0,
            lng: 0,
            distance_m: 100,
            rating: null,
            user_ratings_total: null,
            icon: null,
          },
        ]}
      />,
    );
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("itemHref が null の場合、Link にならずクリックで onItemClick が呼ばれる", () => {
    const onItemClick = vi.fn();

    const item: NearbyItem = {
      kind: "place",
      place_id: "pid",
      title: "クリック対象",
      subtitle: "sub",
      lat: 35,
      lng: 139,
      distance_m: 100,
      rating: null,
      user_ratings_total: null,
      icon: null,
    };

    render(
      <NearbyList lat={35} lng={139} state="success" items={[item]} itemHref={() => null} onItemClick={onItemClick} />,
    );

    fireEvent.click(screen.getByText("クリック対象"));
    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onItemClick).toHaveBeenCalledWith(item);
  });
});
