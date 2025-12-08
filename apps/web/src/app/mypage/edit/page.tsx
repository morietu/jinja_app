// apps/web/src/app/mypage/edit/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import { updateMe } from "@/lib/api/users";

export default function ProfileEditPage() {
  const router = useRouter();
  const { user /* 任意: refresh */ } = useAuth();

  const p = (user?.profile ?? {}) as Partial<{
    nickname: string;
    is_public: boolean;
    website: string;
    birthday: string;
    location: string;
  }>;

  const [form, setForm] = useState({
    nickname: p.nickname ?? user?.username ?? "",
    // UserMe 型には is_public がないので profile だけを見る
    is_public: !!p.is_public,
    website: p.website ?? "",
    // auth の user 型には icon が載っていないため any キャストで初期値を拾う
    icon: (user as any)?.icon ?? "",
    birthday: p.birthday ?? "",
    location: p.location ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function onChange<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function isHttpUrl(u?: string) {
    if (!u) return true;
    try {
      const x = new URL(u);
      return x.protocol === "http:" || x.protocol === "https:";
    } catch {
      return false;
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); // ★ A案：まず送信抑止
    if (saving) return;

    // 入力チェック
    if (!isHttpUrl(form.website)) {
      setErr("Webは http(s) のURLで入力してください");
      return;
    }
    if (form.icon && !isHttpUrl(form.icon)) {
      setErr("アイコンURLは http(s) のURLで入力してください");
      return;
    }

    setSaving(true);
    setErr(null);
    setMsg(null);

    try {
      await updateMe({
        nickname: form.nickname?.trim(),
        is_public: !!form.is_public,
        website: form.website?.trim() || undefined,
        icon_url: form.icon?.trim() || undefined,
        birthday: form.birthday?.trim() || undefined,
        location: form.location?.trim() || undefined,
      });

      // TODO: refresh?.() が用意できたら有効化
      // await refresh?.();

      setMsg("保存しました。");
      // 表示を戻す（即時でOKならこのまま）
      router.replace("/mypage?tab=profile");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">プロフィール編集</h1>

      {err && (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-red-700">
          {err}
        </div>
      )}
      {msg && (
        <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">
          {msg}
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border bg-white p-5"
        role="form"
      >
        <div>
          <label className="block text-sm font-medium">ニックネーム</label>
          <input
            className="mt-1 w-full rounded border p-2"
            value={form.nickname}
            onChange={(e) => onChange("nickname", e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_public}
            onChange={(e) => onChange("is_public", e.target.checked)}
          />
          プロフィールを公開する
        </label>

        <div>
          <label className="block text-sm font-medium">Web</label>
          <input
            className="mt-1 w-full rounded border p-2"
            placeholder="https://example.com"
            value={form.website}
            onChange={(e) => onChange("website", e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium">アイコンURL</label>
          <input
            className="mt-1 w-full rounded border p-2"
            placeholder="https://…/icon.png"
            value={form.icon}
            onChange={(e) => onChange("icon", e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">生年月日</label>
            <input
              type="date"
              className="mt-1 w-full rounded border p-2"
              value={form.birthday}
              onChange={(e) => onChange("birthday", e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">地域</label>
            <input
              className="mt-1 w-full rounded border p-2"
              value={form.location}
              onChange={(e) => onChange("location", e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "保存中…" : "保存する"}
          </button>
          <button
            type="button"
            onClick={() => history.back()}
            className="rounded border px-4 py-2 hover:bg-gray-50"
          >
            キャンセル
          </button>
        </div>
      </form>
    </main>
  );
}
