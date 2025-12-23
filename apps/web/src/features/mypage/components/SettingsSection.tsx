// apps/web/src/features/mypage/components/SettingsSection.tsx
"use client";

import Link from "next/link";

type Props = {
  // 実際の型は気にせず any でOK（既存の user オブジェクト想定）
  user: any;
};

export default function SettingsSection({ user }: Props) {
  const profile = user?.profile ?? null;
  const username: string | null = user?.username ?? null;
  const isPublic: boolean = profile?.is_public ?? user?.is_public ?? false;

  const hasPublicPage = Boolean(username && isPublic);

  return (
    <section className="rounded-2xl border border-orange-100 bg-white px-6 py-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-800">
        <span className="inline-block h-5 w-1 rounded-full bg-orange-400" />
        設定
      </h2>

      <div className="space-y-4 text-sm text-gray-700">
        <p className="text-xs text-gray-500">
          プロフィールの公開設定や自己紹介、SNS リンクの編集は 「プロフィールを編集する」から行えます。
        </p>

        <div>
          
        </div>

        {/* 公開中だけ「公開プロフィールページ」へのリンクを出す */}
        {hasPublicPage && (
          <div className="pt-3 border-t border-orange-50">
            <div className="text-xs text-gray-400">公開プロフィールページ</div>
            <Link
              href={`/users/${username}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex text-xs text-blue-600 underline break-all"
            >
              /users/{username}
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
