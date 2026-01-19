// apps/web/src/features/concierge/sections/dummy.ts
export const DUMMY_SECTIONS = {
  version: 1,
  sections: [
    {
      type: "guide",
      text: "状況を整理しました。おすすめを表示します。",
    },
    {
      type: "recommendations",
      title: "おすすめ",
      items: [
        {
          kind: "registered",
          shrineId: 14,
          title: "日枝神社",
          address: "東京都千代田区永田町2-10-5",
          description: "正式登録されている神社です。",
          imageUrl: null,
          goriyakuTags: [{ id: 1, name: "仕事運" }],
          initialFav: false,
        },
      ],
    },
    {
      type: "actions",
      items: [
        { action: "add_condition", label: "条件を追加して絞る" },
        { action: "open_map", label: "地図で近くの神社を見る" },
      ],
    },
  ],
} as const;
