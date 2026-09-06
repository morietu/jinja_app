// src/lib/types.ts

export type Goshuin = {
  id: number;
  shrine?: number | null;
  shrine_name?: string | null;
  title?: string | null;
  is_public: boolean;
  likes?: number | null;
  created_at?: string | null;
  image_url?: string | null;
};

export type GoriyakuTag = {
  id: number;
  name: string;
  category?: string | null;
};

// backend/temples/api/serializers/shrine.py の ShrineKnowledgeSourceSerializer に一致する
// (note/verified_at/accessed_at/bibliography/languageは非公開。実際に返す field のみ定義する)
export type ShrineKnowledgeSource = {
  id: number;
  source_type: string;
  title: string;
  publisher: string;
  url: string;
  verification_status: string;
  confidence: string;
};

// backend/temples/api/serializers/shrine.py の ShrineDeitySerializer に一致する
// (canonical_name/note/verified_at/aliasesは非公開。実際に返す field のみ定義する)
export type ShrineDeity = {
  id: number;
  display_name: string;
  canonical_name: string;
  role: string;
  sort_order: number;
  verification_status: string;
  confidence: string;
  sources: ShrineKnowledgeSource[];
};

// backend/temples/api/serializers/shrine.py の ShrineHistorySerializer に一致する
// (note/verified_atは非公開。実際に返す field のみ定義する)
export type ShrineHistory = {
  id: number;
  history_type: string;
  title: string;
  content: string;
  period_text: string;
  event_date: string | null;
  sort_order: number;
  verification_status: string;
  confidence: string;
  sources: ShrineKnowledgeSource[];
};

export type ShrineBase = {
  id: number;
  name_jp: string;
  name_romaji?: string | null;
  address: string;

  latitude: number | null;
  longitude: number | null;

  // うっかり参照をコンパイルで殺す
  lat?: never;
  lng?: never;

  main_photo?: string | null;
  main_photo_url?: string | null;
  photo_urls?: string[] | null;
  goriyaku?: string;
  sajin?: string;
  description?: string | null;
  goriyaku_tags: GoriyakuTag[];

  // ShrineListSerializerのみ返す（ShrineDetailSerializer/ShrinePublicSerializerには存在しない）。
  // ISO 8601 datetime。/shrines一覧の「新着」表示（lib/shrine/isNewShrine.ts）が参照する。
  created_at?: string | null;

  // ShrineDetailSerializerのみ返す（ShrinePublicSerializer/ShrineListSerializerには存在しない）。
  // 通常Detail API(/api/shrines/{id}/data/)経由でのみ値が入る。
  deities?: ShrineDeity[];
  histories?: ShrineHistory[];
};

export type Shrine = ShrineBase;

export type RankingItem = ShrineBase & {
  score: number;
  visit_count: number;
  favorite_count: number;
};

export type Paginated<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};
