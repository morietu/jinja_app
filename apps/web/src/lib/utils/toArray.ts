// どんな形でも「配列」に正規化する
export function toArray<T = unknown>(data: any): T[] {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;   // DRF
  if (data && Array.isArray(data.items)) return data.items;       // 他実装
  return [];
}

export type PaginationMeta = {
  count?: number;
  next?: string | null;
  previous?: string | null;
};

// ページネーションのメタ情報だけ取り出す（あれば）
export function pickPaginationMeta(data: any): PaginationMeta {
  return {
    count: data?.count,
    next: data?.next ?? null,
    previous: data?.previous ?? null,
  };
}
