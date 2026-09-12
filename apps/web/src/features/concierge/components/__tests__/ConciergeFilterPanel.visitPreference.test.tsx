// Level 2 Visit Preference Signal Redesign -- Structured Signal Mapping tests.
// See docs/product/concierge-input-architecture.md Addendum: Level 2 Visit
// Preference Signal Redesign.
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ConciergeFilterPanel from "../ConciergeFilterPanel";

const baseProps = {
  isOpen: true,
  onClose: vi.fn(),
  onApply: vi.fn(),
  birthdate: "",
  onBirthdateChange: vi.fn(),
  element4: null,
  goriyakuTags: [],
  suggestedTags: [],
  selectedTagIds: [],
  onToggleTag: vi.fn(),
  tagsLoading: false,
  tagsError: null,
  plannedVisitDate: "",
  userOrigin: null,
  onPlannedVisitDateChange: vi.fn(),
  onOriginChange: vi.fn(),
  onUseCurrentLocation: vi.fn(),
};

describe("ConciergeFilterPanel Visit Preference Structured Signal Mapping", () => {
  it("clicking a Keep preset sends both the legacy extraCondition text and the canonical tag", () => {
    const onExtraConditionChange = vi.fn();
    const onVisitPreferencesChange = vi.fn();

    render(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition=""
        onExtraConditionChange={onExtraConditionChange}
        visitPreferences={[]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("静かな時間を過ごしたい"));

    expect(onExtraConditionChange).toHaveBeenCalledWith("静かな雰囲気で、気持ちを落ち着けて整理できる場所がいい");
    expect(onVisitPreferencesChange).toHaveBeenCalledWith(["quiet"]);
  });

  it("clicking a Redesign preset (歴史や文化に触れたい) sends the classic canonical tag directly, no keyword parsing", () => {
    const onVisitPreferencesChange = vi.fn();

    render(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition=""
        onExtraConditionChange={vi.fn()}
        visitPreferences={[]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("歴史や文化に触れたい"));

    expect(onVisitPreferencesChange).toHaveBeenCalledWith(["classic"]);
  });

  it("clicking アクセスしやすい場所がいい maps to nearby (per visit-style-taxonomy.md)", () => {
    const onVisitPreferencesChange = vi.fn();

    render(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition=""
        onExtraConditionChange={vi.fn()}
        visitPreferences={[]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("アクセスしやすい場所がいい"));

    expect(onVisitPreferencesChange).toHaveBeenCalledWith(["nearby"]);
  });

  it("clicking 境内をゆっくり歩きたい sends both quiet and nature (multi-tag preset)", () => {
    const onVisitPreferencesChange = vi.fn();

    render(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition=""
        onExtraConditionChange={vi.fn()}
        visitPreferences={[]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("境内をゆっくり歩きたい"));

    const sent = onVisitPreferencesChange.mock.calls[0][0] as string[];
    expect(new Set(sent)).toEqual(new Set(["quiet", "nature"]));
  });

  it("clicking 御朱印を楽しみたい (Hold, no Shrine-side capability) updates extraCondition but never calls onVisitPreferencesChange", () => {
    const onExtraConditionChange = vi.fn();
    const onVisitPreferencesChange = vi.fn();

    render(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition=""
        onExtraConditionChange={onExtraConditionChange}
        visitPreferences={[]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("御朱印を楽しみたい"));

    expect(onExtraConditionChange).toHaveBeenCalled();
    expect(onVisitPreferencesChange).not.toHaveBeenCalled();
  });

  it("selecting two presets that resolve to the same tag does not duplicate it", () => {
    const onVisitPreferencesChange = vi.fn();

    const { rerender } = render(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition=""
        onExtraConditionChange={vi.fn()}
        visitPreferences={[]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("近場がいい")); // -> nearby
    expect(onVisitPreferencesChange).toHaveBeenLastCalledWith(["nearby"]);

    rerender(
      <ConciergeFilterPanel
        {...baseProps}
        extraCondition="できるだけ近い場所を優先して"
        onExtraConditionChange={vi.fn()}
        visitPreferences={["nearby"]}
        onVisitPreferencesChange={onVisitPreferencesChange}
      />,
    );

    fireEvent.click(screen.getByText("アクセスしやすい場所がいい")); // -> nearby (same tag)
    expect(onVisitPreferencesChange).toHaveBeenLastCalledWith(["nearby"]);
  });

  it("renders without crashing when visitPreferences/onVisitPreferencesChange are omitted (backward compatible props)", () => {
    render(<ConciergeFilterPanel {...baseProps} extraCondition="" onExtraConditionChange={vi.fn()} />);

    expect(() => fireEvent.click(screen.getByText("静かな時間を過ごしたい"))).not.toThrow();
  });
});
