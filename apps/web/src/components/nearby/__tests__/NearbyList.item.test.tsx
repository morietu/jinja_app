// NearbyList.item.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NearbyListItem } from "../NearbyList.Item";

describe("NearbyListItem", () => {
  it("shows title/subtitle and formats distance in km when >= 1000m", () => {
    render(
      <NearbyListItem
        kind="place"
        place_id="p1"
        title="明治神宮"
        subtitle="東京都渋谷区"
        lat={35.0}
        lng={139.0}
        distance_m={1200}
        rating={null}
        user_ratings_total={null}
        icon={null}
      />,
    );

    expect(screen.getByText("明治神宮")).toBeInTheDocument();
    expect(screen.getByText("東京都渋谷区")).toBeInTheDocument();
    expect(screen.getByText(/1\.2\s?km/)).toBeInTheDocument();

    // aria-label 付与済みならここも通る（後述）
    expect(screen.getByRole("listitem", { name: /距離\s*1\.2\s*km/ })).toBeInTheDocument();
  });

  it("formats distance in meters under 1000m", () => {
    render(
      <NearbyListItem
        kind="place"
        place_id="m1"
        title="近所の神社"
        subtitle={undefined}
        lat={35.0}
        lng={139.0}
        distance_m={120}
        rating={null}
        user_ratings_total={null}
        icon={null}
      />,
    );

    expect(screen.getByText("近所の神社")).toBeInTheDocument();
    expect(screen.getByText("120 m")).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /距離\s*120\s*m/ })).toBeInTheDocument();
  });
});
