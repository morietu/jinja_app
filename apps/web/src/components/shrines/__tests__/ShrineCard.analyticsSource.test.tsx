import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ShrineCard from "../ShrineCard";

vi.mock("@/lib/analytics/searchEvents", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/analytics/searchEvents")>();
  return { ...actual, trackSearchEvent: vi.fn() };
});

import { trackSearchEvent } from "@/lib/analytics/searchEvents";

describe("ShrineCard shrine_card_click の source", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("analyticsSource未指定の既存callerは従来どおり source=shrines", () => {
    render(<ShrineCard name="既存神社" shrineId={1} href="/shrines/1" />);

    screen.getByRole("link").click();

    expect(trackSearchEvent).toHaveBeenCalledWith("shrine_card_click", {
      source: "shrines",
      shrineId: 1,
    });
  });

  it("analyticsSourceを指定したcallerはその値を送る（Weekly Compassは compass）", () => {
    render(<ShrineCard name="Weekly神社" shrineId={2} href="/shrines/2" analyticsSource="compass" />);

    screen.getByRole("link").click();

    expect(trackSearchEvent).toHaveBeenCalledWith("shrine_card_click", {
      source: "compass",
      shrineId: 2,
    });
  });

  it("hrefが無いカードはクリックしてもイベントを送らない（既存挙動）", () => {
    render(<ShrineCard name="リンクなし神社" shrineId={3} analyticsSource="compass" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(trackSearchEvent).not.toHaveBeenCalled();
  });
});
