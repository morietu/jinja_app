// apps/web/src/app/mypage/settings/page.tsx
import MyPageSettingsView from "@/components/views/MyPageSettingsView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MyPageSettingsPage() {
  return <MyPageSettingsView />;
}
