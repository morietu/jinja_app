// apps/web/src/app/mypage/profile/page.tsx
import MyPageProfileView from "@/components/views/MyPageProfileView";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function MyPageProfilePage() {
  return <MyPageProfileView />;
}
