"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ChangeEvent, FormEvent } from "react";

import { getGoriyakuTags } from "@/lib/api/tags";
import { isApiError } from "@/lib/api/errors";
import { createShrineSubmission } from "@/lib/api/shrineSubmissions";
import type {
  ShrineSubmissionFieldErrors,
  ShrineSubmissionFormValues,
  ShrineSubmissionResponse,
  ShrineSubmissionTag,
} from "@/features/shrine-submission/types";

type Props = {
  onSubmitted: (submission: ShrineSubmissionResponse) => void;
  onRequireAuth: () => void;
};

export function ShrineSubmissionForm({ onSubmitted, onRequireAuth }: Props) {
  const router = useRouter();

  const [form, setForm] = useState<ShrineSubmissionFormValues>({
    name: "",
    address: "",
    note: "",
  });
  const [errors, setErrors] = useState<ShrineSubmissionFieldErrors>({});
  const [tags, setTags] = useState<ShrineSubmissionTag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [duplicateQuery, setDuplicateQuery] = useState<string | null>(null);

  useEffect(() => {
    getGoriyakuTags()
      .then(setTags)
      .catch(() => {
        setErrors((prev) => ({
          ...prev,
          tags: "ご利益タグの取得に失敗しました",
        }));
      });
  }, []);

  const selectedTagNames = useMemo(
    () => tags.filter((tag) => selectedTags.includes(tag.id)).map((tag) => tag.name),
    [selectedTags, tags],
  );

  const clearErrors = (...keys: string[]) => {
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of keys) {
        delete next[key];
      }
      return next;
    });
  };

  const isDuplicateMessage = (message?: string) => {
    if (!message) return false;
    return message.includes("重複") || message.includes("既に存在");
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.currentTarget;
    setForm((prev) => ({ ...prev, [name]: value }));
    clearErrors(name, "non_field_errors", "general");
    setDuplicateQuery(null);
  };

  const toggleTag = (id: number) => {
    if (isSubmitting) return;

    setSelectedTags((prev) => (prev.includes(id) ? prev.filter((tagId) => tagId !== id) : [...prev, id]));
    clearErrors("tags", "non_field_errors", "general");
    setDuplicateQuery(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const name = form.name.trim();
    const address = form.address.trim();
    const note = form.note.trim();

    const nextErrors: ShrineSubmissionFieldErrors = {};

    if (!name) {
      nextErrors.name = "神社名は必須です。";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setIsSubmitting(true);
    setDuplicateQuery(null);
    clearErrors("name", "address", "tags", "note", "general");

    try {
      const created = await createShrineSubmission({
        name,
        address,
        goriyaku_tags: selectedTagNames,
        note,
      });

      onSubmitted(created);
    } catch (err: unknown) {
      if (isApiError(err)) {
        if (err.status === 400 && err.body && typeof err.body === "object") {
          const body = err.body as Record<string, unknown>;
          const next: ShrineSubmissionFieldErrors = {};

          for (const [key, value] of Object.entries(body)) {
            if (Array.isArray(value) && typeof value[0] === "string") {
              next[key] = value[0];
            } else if (typeof value === "string") {
              next[key] = value;
            }
          }

          const backendMessage = next.non_field_errors ?? next.general ?? "入力内容を確認してください。";

          const duplicate = isDuplicateMessage(backendMessage);

          setErrors({
            ...next,
            general: duplicate ? "この神社はすでに登録されている可能性があります。" : backendMessage,
          });

          if (duplicate) {
            setDuplicateQuery(name);
          }

          return;
        }

        if (err.status === 401 || err.status === 403) {
          onRequireAuth();
          return;
        }
      }

      setErrors((prev) => ({
        ...prev,
        general: "投稿に失敗しました。時間をおいて再度お試しください。",
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      {errors.general && (
        <div className="space-y-3">
          <p className="text-sm text-red-600">{errors.general}</p>

          {duplicateQuery && (
            <>
              <p className="text-sm text-slate-700">既存の神社をご確認ください。</p>
              <div className="pt-1">
                <button
                  type="button"
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-700"
                  onClick={() => router.push(`/shrines?q=${encodeURIComponent(duplicateQuery)}`)}
                >
                  既存神社を見る
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium text-slate-900">
          神社名
        </label>
        <input
          id="name"
          name="name"
          value={form.name}
          onChange={handleChange}
          disabled={isSubmitting}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          placeholder="例: 明治神宮"
        />
        {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
      </div>

      <div className="space-y-2">
        <label htmlFor="address" className="text-sm font-medium text-slate-900">
          住所
        </label>
        <input
          id="address"
          name="address"
          value={form.address}
          onChange={handleChange}
          disabled={isSubmitting}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          placeholder="例: 東京都渋谷区代々木神園町1-1"
        />
        {errors.address && <p className="text-xs text-red-600">{errors.address}</p>}
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-slate-900">ご利益タグ</p>
          <p className="text-xs text-slate-500">該当するものだけ選択してください。</p>
        </div>

        {errors.tags && <p className="text-xs text-red-600">{errors.tags}</p>}

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const active = selectedTags.includes(tag.id);
            return (
              <button
                key={tag.id}
                type="button"
                disabled={isSubmitting}
                onClick={() => toggleTag(tag.id)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  active
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="note" className="text-sm font-medium text-slate-900">
          補足文
        </label>
        <textarea
          id="note"
          name="note"
          value={form.note}
          onChange={handleChange}
          disabled={isSubmitting}
          className="min-h-32 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900"
          placeholder="この神社を追加したい理由や補足情報を書いてください。"
        />
        {errors.note && <p className="text-xs text-red-600">{errors.note}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "投稿中..." : "審査用に投稿する"}
      </button>
    </form>
  );
}
