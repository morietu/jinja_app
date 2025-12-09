// apps/web/src/app/mypage/tabs.ts
export type TabKey = "profile" | "favorites" | "goshuin";

export const TABS: TabKey[] = ["profile", "favorites", "goshuin"];

export function sanitizeTab(v?: string | null): TabKey {
  if (!v) return "profile";
  return TABS.includes(v as TabKey) ? (v as TabKey) : "profile";
}
