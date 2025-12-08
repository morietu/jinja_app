"use client";

import Image from "next/image";

type Props = {
  // 実際の型は気にせず any で受けておく（既存の user オブジェクト想定）
  user: any;
};

export default function ProfileSection({ user }: Props) {
  const profile = user?.profile ?? null;

  const nickname: string = profile?.nickname ?? user?.nickname ?? user?.username ?? "未設定";
  const email: string = user?.email ?? "未設定";

  const rawLocation: string | null = profile?.location ?? null;
  const bio: string = profile?.bio ?? "自己紹介はまだ設定されていません。";
  const isPublic: boolean = profile?.is_public ?? user?.is_public ?? false;

  // backend 側でどこに website を持たせているか曖昧なので両方見る
  const website: string | null = profile?.website ?? (user as any)?.website ?? null;

  // 「http から始まる URL だけ有効」とみなす
  const hasWebsite = typeof website === "string" && website.trim().length > 0 && /^https?:\/\//i.test(website.trim());

  // 生年月日（YYYY-MM-DD 前提）＋年齢
  const birthday: string | null = profile?.birthday ?? null;

  const birthdayText: string | null = (() => {
    if (!birthday) return null;
    const d = new Date(birthday);
    if (Number.isNaN(d.getTime())) {
      // パースできなければそのまま
      return birthday;
    }
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) {
      age--;
    }
    // テストは 1990/04/10 or 1990-04-10 を許容しているので元文字列をそのまま使う
    return `${birthday}（${age}歳）`;
  })();

  return (
    <section className="rounded-2xl border border-orange-100 bg-white px-6 py-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-800">
        <span className="inline-block h-5 w-1 rounded-full bg-orange-400" />
        プロフィール
      </h2>

      <div className="flex gap-6">
        {/* 左：アイコン＋公開状態 */}
        <div className="flex flex-col items-center gap-2">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full bg-gray-100">
                <Image
                  alt="プロフィールアイコン"
                  src={user?.icon || "/images/default-avatar.png"}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                {/* ここは編集フォームと連動しているだけなので見た目だけ残す */}
                <label className="inline-flex cursor-pointer items-center rounded-full border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  <input type="file" accept="image/*" className="hidden" />
                  アイコンを変更
                </label>
                <p className="text-[11px] text-gray-400">画像ファイル（5MB 以下）を選択してください。</p>
              </div>
            </div>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
            {isPublic ? "公開" : "非公開"}
          </span>
        </div>

        {/* 右：プロフィール情報 */}
        <div className="flex-1 space-y-3 text-sm text-gray-700">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {/* ユーザー名 */}
            <div>
              <div className="text-xs text-gray-400">ユーザー名</div>
              <div>{nickname}</div>
            </div>

            {/* メール */}
            <div>
              <div className="text-xs text-gray-400">メール</div>
              <div>{email}</div>
            </div>

            {/* 地域：未設定なら "-"（テスト側は「どこかに - があること」を見ている） */}
            <div>
              <div className="text-xs text-gray-400">地域</div>
              <div>{rawLocation || "-"}</div>
            </div>

            {/* Webサイト：有効な URL のときだけ欄ごと表示 */}
            {hasWebsite && (
              <div>
                <div className="text-xs text-gray-400">Webサイト</div>
                <a
                  href={website!}
                  className="text-xs text-blue-600 underline break-all"
                  target="_blank"
                  rel="noreferrer"
                >
                  {website}
                </a>
              </div>
            )}

            {/* 生年月日：birthday があれば「日付＋年齢」、なければ "-" */}
            <div>
              <div className="text-xs text-gray-400">生年月日</div>
              <div>{birthdayText ?? "-"}</div>
            </div>
          </div>

          {/* 自己紹介 */}
          <div>
            <div className="text-xs text-gray-400">自己紹介</div>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{bio}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
