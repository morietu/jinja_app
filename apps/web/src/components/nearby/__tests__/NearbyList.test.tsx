import { render, screen } from "@testing-library/react";
import { NearbyList } from "../../nearby/NearbyList";

test("shows loading skeleton", () => {
  render(<NearbyList lat={0} lng={0} state="loading" />);
  expect(screen.getByRole("status")).toBeInTheDocument();
});

test("shows empty", () => {
  render(<NearbyList lat={0} lng={0} state="empty" />);
  expect(screen.getByText("見つかりませんでした")).toBeInTheDocument();
});

test("shows error", () => {
  render(<NearbyList lat={0} lng={0} state="error" errorMessage="boom" />);
  expect(screen.getByRole("alert")).toBeInTheDocument();
});

test("shows items", () => {
  render(
    <NearbyList
      lat={0}
      lng={0}
      state="success"
      items={[{ id: "1", name: "A", distanceMeters: 100 }]}
    />
  );
  expect(screen.getByRole("list")).toBeInTheDocument();
});
