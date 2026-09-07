"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { updateUser, type UpdateUserProfilePayload } from "@/lib/api/users";
import { useAuth as useAuthContext } from "@/lib/auth/AuthProvider";
import type { AuthUser } from "@/lib/auth/types";
import { buildLoginHref } from "@/lib/nav/login";

const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県", "茨城県", "栃木県", "群馬県",
  "埼玉県", "千葉県", "東京都", "神奈川県", "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県",
  "岐阜県", "静岡県", "愛知県", "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県", "徳島県", "香川県", "愛媛県", "高知県", "福岡県",
  "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
];

// HUB分割後のプロフィール編集面で扱うのはこの4項目のみ。
// worship_style / is_public はDB fieldも保存値もそのまま残し、この画面のUIから外すだけ。
type ProfileForm = {
  nickname: string;
  birthday: string;
  birth_time: string;
  birth_place: string;
};

function profileToForm(profile: AuthUser["profile"]): ProfileForm {
  return {
    nickname: (profile?.nickname ?? "").trim(),
    birthday: profile?.birthday ?? "",
    birth_time: profile?.birth_time?.slice(0, 5) ?? "",
    birth_place: profile?.birth_place ?? "",
  };
}

function todayInputMax(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export default function MyPageProfileView() {
  const { user: authUser, loading, refreshMe } = useAuthContext();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [form, setForm] = useState<ProfileForm>(() => profileToForm(null));
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!authUser) {
      setUser(null);
      return;
    }

    setUser(authUser);
    setForm(profileToForm(authUser.profile));
  }, [authUser]);

  const dirty = useMemo(() => {
    if (!user) return false;
    const initial = profileToForm(user.profile);
    return (Object.keys(initial) as (keyof ProfileForm)[]).some((key) => form[key] !== initial[key]);
  }, [user, form]);

  const handleSave = async () => {
    if (!user || !dirty || saving) return;

    setSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    try {
      // 変更のあったfieldだけをPATCHする（worship_style等の未編集fieldは送らない）。
      const initial = profileToForm(user.profile);
      const payload: UpdateUserProfilePayload = {};
      if (form.nickname !== initial.nickname) payload.nickname = form.nickname;
      if (form.birthday !== initial.birthday) payload.birthday = form.birthday || null;
      if (form.birth_time !== initial.birth_time) payload.birth_time = form.birth_time || null;
      if (form.birth_place !== initial.birth_place) payload.birth_place = form.birth_place;

      const updated = await updateUser(payload);
      setUser(updated);
      setForm(profileToForm(updated.profile));
      setSaveMessage("プロフィールを保存しました。");
      await refreshMe();
    } catch {
      setSaveError("プロフィールを保存できませんでした。入力内容を確認して、もう一度お試しください。");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!user) return;
    setForm(profileToForm(user.profile));
    setSaveMessage(null);
    setSaveError(null);
  };

  if (loading) {
    return (
      <div className="p-4 text-sm text-[var(--kt-color-text-secondary)]" role="status" aria-busy="true">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-3xl p-6 text-[var(--kt-color-text-primary)]">
        <h1 className="mb-4 text-xl font-semibold">プロフィール</h1>
        <div className="rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-6">
          <p className="mb-3 text-sm text-[var(--kt-color-text-secondary)]">ログインしてご利用ください。</p>
          <Link
            href={buildLoginHref("/mypage/profile")}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-action-primary)] px-4 text-sm text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)]"
          >
            ログインへ
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-[var(--kt-color-text-primary)] sm:px-6">
      <div>
        <Link href="/mypage" className="text-xs text-[var(--kt-color-text-muted)] underline">
          ← マイページへ
        </Link>
        <h1 className="mt-2 text-xl font-semibold">プロフィール</h1>
      </div>

      <section className="space-y-5 rounded-2xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] p-5">
        <div>
          <label
            htmlFor="profile-nickname"
            className="mb-1 block text-sm font-medium text-[var(--kt-color-text-secondary)]"
          >
            ニックネーム
          </label>
          <input
            id="profile-nickname"
            type="text"
            value={form.nickname}
            onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
            disabled={saving}
            className="min-h-11 w-full rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-sm text-[var(--kt-color-text-primary)] outline-none transition placeholder:text-[var(--kt-color-text-muted)] focus:border-[var(--kt-color-border-strong)] focus:ring-2 focus:ring-[var(--kt-color-border-default)] disabled:opacity-60"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-[var(--kt-color-text-secondary)]">
            生年月日
            <input
              type="date"
              min="1900-01-01"
              max={todayInputMax()}
              value={form.birthday}
              onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
              disabled={saving}
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--kt-color-border-default)] disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--kt-color-text-secondary)]">
            出生時間 <span className="font-normal text-[var(--kt-color-text-muted)]">（不明でも可）</span>
            <input
              type="time"
              step="300"
              value={form.birth_time}
              onChange={(e) => setForm((f) => ({ ...f, birth_time: e.target.value }))}
              disabled={saving}
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--kt-color-border-default)] disabled:opacity-60"
            />
          </label>

          <label className="block text-sm font-medium text-[var(--kt-color-text-secondary)]">
            出生地
            <select
              value={form.birth_place}
              onChange={(e) => setForm((f) => ({ ...f, birth_place: e.target.value }))}
              disabled={saving}
              className="mt-1 min-h-11 w-full rounded-xl border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--kt-color-border-default)] disabled:opacity-60"
            >
              <option value="">不明・未設定</option>
              {PREFECTURES.map((prefecture) => (
                <option key={prefecture} value={prefecture}>
                  {prefecture}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-action-primary)] bg-[var(--kt-color-action-primary)] px-4 text-sm text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)] disabled:opacity-40"
          >
            {saving ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={!dirty || saving}
            className="inline-flex min-h-11 items-center rounded-full border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 text-sm text-[var(--kt-color-text-secondary)] transition hover:bg-[var(--kt-color-background-subtle)] disabled:opacity-40"
          >
            変更を破棄
          </button>
        </div>

        {saveMessage ? (
          <p role="status" className="text-sm font-medium text-[var(--kt-color-status-success)]">
            {saveMessage}
          </p>
        ) : null}
        {saveError ? (
          <p role="alert" className="text-sm font-medium text-[var(--kt-color-status-error)]">
            {saveError}
          </p>
        ) : null}
      </section>
    </main>
  );
}
