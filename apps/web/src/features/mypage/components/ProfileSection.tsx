// apps/web/src/features/mypage/components/ProfileSection.tsx
import ProfileIconUploader from "./ProfileIconUploader";
import type { UserMe } from "@/lib/api/users";

type Props = {
  user: UserMe;
};

export default function ProfileSection({ user }: Props) {
  const profile = user.profile;

  const nickname = profile?.nickname || user.username || "未設定";
  const email = user.email || "未設定";
  const location = profile?.location || "未設定";
  const bio = profile?.bio || "自己紹介はまだ設定されていません。";
  const isPublic = profile?.is_public ?? false;

  return (
    <div className="flex gap-6">
      {/* 左：アイコン＋公開ステータス */}
      <div className="flex flex-col items-center gap-2">
        <div className="space-y-4">
          {/* ★ アイコンアップロード */}
          <ProfileIconUploader user={user} />
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
          {isPublic ? "公開" : "非公開"}
        </span>
      </div>

      {/* 右：プロフィール情報 */}
      <div className="flex-1 space-y-3 text-sm text-gray-700">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          <div>
            <div className="text-xs text-gray-400">ユーザー名</div>
            <div>{nickname}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">メール</div>
            <div>{email}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">地域</div>
            <div>{location}</div>
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-400">自己紹介</div>
          <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{bio}</p>
        </div>
      </div>
    </div>
  );
}
