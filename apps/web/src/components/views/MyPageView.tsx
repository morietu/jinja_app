// apps/web/src/components/views/MyPageView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getCurrentUser, updateUser, type UserMe } from "@/lib/api/users";

export default function MyPageView() {
  const [user, setUser] = useState<UserMe | null>(null);
  const [form, setForm] = useState({
    nickname: "",
    is_public: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const me = await getCurrentUser();
      if (me) {
        setUser(me);
        setForm({
          nickname: me.profile.nickname ?? "",
          is_public: !!me.profile.is_public,
        });
      }
      setLoading(false);
    })();
  }, []);

  // 変更有無（前後の空白は無視して比較）
  const dirty = useMemo(() => {
    if (!user) return false;
    const nick0 = (user.profile.nickname ?? "").trim();
    const nick1 = (form.nickname ?? "").trim();
    const nickDirty = nick1 !== nick0;
    const publicDirty = Boolean(form.is_public) !== Boolean(user.profile.is_public);
    return nickDirty || publicDirty;
  }, [
    user,                 // 取得後のスナップショットが変わったら再計算
    form.nickname,        // 入力の変化で再計算
    form.is_public,
  ]);

  const handleSave = async () => {
    if (!user || !dirty || saving) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      const nick0 = (user.profile.nickname ?? "").trim();
      const nick1 = (form.nickname ?? "").trim();
      if (nick1 !== nick0) payload.nickname = nick1;
      if (Boolean(form.is_public) !== Boolean(user.profile.is_public)) {
        payload.is_public = form.is_public;
      }

      const updated = await updateUser(payload);
      setUser(updated);
      setForm({
        nickname: (updated.profile.nickname ?? "").trim(),
        is_public: !!updated.profile.is_public,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!user) return;
    setForm({
      nickname: user.profile.nickname ?? "",
      is_public: !!user.profile.is_public,
    });
  };

  if (loading) return <div className="p-4 text-sm text-gray-500">読み込み中...</div>;
  if (!user)   return <div className="p-4 text-sm text-red-600">未ログインです。</div>;

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium mb-1">ニックネーム</label>
        <input
          type="text"
          value={form.nickname}
          onChange={(e) => setForm((f) => ({ ...f, nickname: e.target.value }))}
          disabled={saving}
          className="w-full border rounded px-3 py-2"
        />
      </div>

      <label className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          checked={form.is_public}
          onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
          disabled={saving}
        />
        <span>プロフィールを公開</span>
      </label>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          title={!dirty ? "変更すると有効になります" : undefined}
          className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          onClick={handleReset}
          disabled={!dirty || saving}
          className="px-4 py-2 rounded border"
        >
          変更を破棄
        </button>
      </div>
    </div>
  );
}
