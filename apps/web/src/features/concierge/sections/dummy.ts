import type { ConciergeFilterState, ConciergeSectionsPayload } from "./types";

export function buildDummySections(filterState: ConciergeFilterState): ConciergeSectionsPayload {
  return {
    version: 1,
    sections: [
      {
        type: "filter",
        title: "条件を追加して絞る",
        closedLabel: "条件を追加して絞る",
        state: filterState,
      },
      { type: "guide", text: "状況を整理しました。必要なら条件を追加して絞れます。" },
      {
        type: "actions",
        items: [{ action: "open_map", label: "地図で近くの神社を見る" }],
      },
    ],
  };
}
