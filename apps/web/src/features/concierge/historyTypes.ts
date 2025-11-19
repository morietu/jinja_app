// apps/web/src/features/concierge/historyTypes.ts

// /api/concierge-threads/ の1件分に対応
export type ConciergeHistoryItem = {
  id: number;
  title: string;
  last_message: string;
  last_message_at: string;
  message_count: number;
};
