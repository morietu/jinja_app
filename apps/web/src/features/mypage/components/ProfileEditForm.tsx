// apps/web/src/features/mypage/components/ProfileEditForm.tsx のどこか
import { uploadUserIcon } from "@/lib/api/users";
import { useAuth } from "@/lib/hooks/useAuth";

function ProfileEditForm() {
  const { refresh } = useAuth();

  async function handleIconChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadUserIcon(file);
    await refresh();
  }

  return (
    <div>
      {/* ここはもう form 直ではなくてOK */}
      <input type="file" accept="image/*" onChange={handleIconChange} />
      {/* ほかのプロフィール項目のフォームは今まで通り PATCH /api/users/me/ でOK */}
    </div>
  );
}
