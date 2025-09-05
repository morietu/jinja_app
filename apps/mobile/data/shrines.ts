// 簡易モック。必要に応じて増やしてOK
export type Shrine = {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];          // ご利益など
  prefecture?: string;
  rating?: number;
  favorites?: number;
  description?: string;
};

export const SHRINES: Shrine[] = [
  {
    id: "meiji",
    name: "明治神宮",
    imageUrl: "https://picsum.photos/seed/meiji/1200/800",
    tags: ["縁結び", "厄除け"],
    prefecture: "東京都",
    rating: 4.7,
    favorites: 320,
    description: "都会の杜に包まれた静謐な神域。初詣で賑わう都内屈指の神社。",
  },
  {
    id: "fushimi",
    name: "伏見稲荷大社",
    imageUrl: "https://picsum.photos/seed/fushimi/1200/800",
    tags: ["商売繁盛", "金運"],
    prefecture: "京都府",
    rating: 4.8,
    favorites: 540,
    description: "千本鳥居で有名な全国の稲荷神社の総本宮。",
  },
  // 追加サンプル
  {
    id: "kanda",
    name: "神田明神",
    imageUrl: "https://picsum.photos/seed/kanda/1200/800",
    tags: ["商売繁盛", "厄除け", "IT守護"],
    prefecture: "東京都",
    rating: 4.6,
    favorites: 210,
    description: "江戸総鎮守。近年はIT関連の祈願でも人気。",
  },
];
