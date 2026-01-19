// apps/web/src/app/concierge/ConciergeClientFull.tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import ConciergeSections from "@/features/concierge/components/ConciergeSections";
import { buildConciergeSections } from "@/features/concierge/sectionsBuilder";
import type { ConciergeSectionsPayload } from "@/features/concierge/sections/types";

import ConciergeLayout from "@/features/concierge/components/ConciergeLayout";
import { useConciergeChat } from "@/features/concierge/hooks";
import type { ConciergeMessage, ConciergeThread } from "@/lib/api/concierge";
import type { StopReason, UnifiedConciergeResponse } from "@/features/concierge/types/unified";
import type { ChatEvent } from "@/features/concierge/types/chat";
import type { ConciergeChatRequestV1, ConciergeChatFilters } from "@/features/concierge/types/chatRequest";

import ConciergeSectionsRenderer from "@/features/concierge/components/ConciergeSectionsRenderer";
import { DUMMY_SECTIONS } from "@/features/concierge/sections/dummy";

import { getGoriyakuTags } from "@/lib/api/tags";

const DEBUG = process.env.NODE_ENV !== "production" && false;

type Element4 = "火" | "地" | "風" | "水";
const LS_BIRTHDATE_KEY = "concierge:birthdate";

// element -> おすすめ（DBのGoriyakuTag.nameと一致させる）
const ELEMENT_TO_GORIYAKU: Record<Element4, string[]> = {
  火: ["仕事運・出世", "勝運・必勝祈願", "開運招福", "厄除け・方除け"],
  地: ["金運・商売繁盛", "健康長寿", "五穀豊穣", "家内安全"],
  風: ["学業成就", "合格祈願"],
  水: ["縁結び", "子宝・安産", "病気平癒"],
};

function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  const [y, m, dd] = s.split("-").map(Number);
  return d.getUTCFullYear() === y && d.getUTCMonth() + 1 === m && d.getUTCDate() === dd;
}

function birthdateToElement4(birthdateISO: string): Element4 | null {
  if (!isValidISODate(birthdateISO)) return null;
  const [, mm, dd] = birthdateISO.split("-");
  const m = Number(mm);
  const d = Number(dd);
  const md = m * 100 + d;

  if (md >= 321 && md <= 419) return "火";
  if (md >= 420 && md <= 520) return "地";
  if (md >= 521 && md <= 621) return "風";
  if (md >= 622 && md <= 722) return "水";
  if (md >= 723 && md <= 822) return "火";
  if (md >= 823 && md <= 922) return "地";
  if (md >= 923 && md <= 1023) return "風";
  if (md >= 1024 && md <= 1122) return "水";
  if (md >= 1123 && md <= 1221) return "火";
  if (md >= 1222 || md <= 119) return "地"; // 山羊（年跨ぎ）
  if (md >= 120 && md <= 218) return "風";
  return "水";
}

type Tag = { id: number; name: string };

function deriveMessages(events: ChatEvent[], threadId: number): ConciergeMessage[] {
  let mid = 0;
  const out: ConciergeMessage[] = [];

  for (const e of events) {
    if (e.type === "user_message") {
      mid += 1;
      out.push({
        id: mid,
        thread_id: threadId,
        role: "user",
        content: e.text,
        created_at: e.at,
      } as ConciergeMessage);
      continue;
    }

    if (e.type === "assistant_reply") {
      mid += 1;
      out.push({
        id: mid,
        thread_id: threadId,
        role: "assistant",
        content: e.text,
        created_at: e.at,
      } as ConciergeMessage);
    }
  }

  return out;
}

type EventsByThread = Record<number, ChatEvent[]>;
const STORAGE_KEY = "concierge:eventsByThread";

function getThreadEvents(map: EventsByThread, tid: number): ChatEvent[] {
  return map[tid] ?? [];
}

function appendEvents(map: EventsByThread, tid: number, next: ChatEvent | ChatEvent[]): EventsByThread {
  const arr = Array.isArray(next) ? next : [next];
  const cur = getThreadEvents(map, tid);
  return { ...map, [tid]: [...cur, ...arr] };
}

function promoteThread(map: EventsByThread, fromTid: number, toTid: number): EventsByThread {
  if (!toTid) return map;
  if (fromTid === toTid) return map;

  const fromEvents = getThreadEvents(map, fromTid);
  const toEvents = getThreadEvents(map, toTid);
  if (!fromEvents.length) return map;

  const next: EventsByThread = { ...map };
  next[toTid] = [...toEvents, ...fromEvents];
  delete next[fromTid];
  return next;
}

function buildPayloadFromUnified(u: UnifiedConciergeResponse | null): ConciergeSectionsPayload | null {
  const recs = u?.data?.recommendations;
  if (!Array.isArray(recs) || recs.length === 0) return null;

  const items = recs
    .map((r: any) => {
      if (typeof r?.id === "number") {
        return {
          kind: "registered" as const,
          shrineId: r.id,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          address: r.display_address ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
          goriyakuTags: [],
          initialFav: false,
        };
      }

      if (typeof r?.place_id === "string") {
        return {
          kind: "place" as const,
          placeId: r.place_id,
          title: String(r.display_name ?? r.name ?? "名称不明"),
          address: r.display_address ?? null,
          description: String(r.reason ?? ""),
          imageUrl: r.photo_url ?? null,
        };
      }

      return null;
    })
    .filter(Boolean) as any[];

  if (items.length === 0) return null;

  return {
    version: 1,
    sections: [
      { type: "guide", text: "おすすめを表示しました。必要なら条件を追加して絞れます。" },
      { type: "recommendations", title: "おすすめ", items },
      {
        type: "actions",
        items: [
          { action: "add_condition", label: "条件を追加して絞る" },
          { action: "open_map", label: "地図で近くの神社を見る" },
        ],
      },
    ],
  };
}

export default function ConciergeClientFull() {
  const router = useRouter();
  const sp = useSearchParams();

  const [eventsByThread, setEventsByThread] = useState<EventsByThread>({});
  const [hydrated, setHydrated] = useState(false);

  const [activeThreadId, setActiveThreadId] = useState<number>(0);
  const activeThreadIdRef = useRef<number>(0);

  const [promotedTid, setPromotedTid] = useState<number | null>(null);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [extraCondition, setExtraCondition] = useState<string>("");

  const [goriyakuTags, setGoriyakuTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [birthdate, setBirthdate] = useState<string>(""); // YYYY-MM-DD
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [tagsLoading, setTagsLoading] = useState(false);

  const setActiveTid = (tid: number) => {
    activeThreadIdRef.current = tid;
    setActiveThreadId(tid);
  };

  const tidFromQuery = useMemo(() => {
    const raw = sp.get("tid");
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  }, [sp]);

  // restore
  useEffect(() => {
    if (DEBUG) console.time("restore");
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEventsByThread(JSON.parse(raw) as EventsByThread);
    } catch {
      // ignore
    } finally {
      if (DEBUG) console.timeEnd("restore");
      setHydrated(true);
    }
  }, []);

  // URL tid -> activeThreadId
  useEffect(() => {
    if (!hydrated) return;
    if (tidFromQuery === 0 && activeThreadIdRef.current !== 0) return;
    setActiveTid(tidFromQuery);
  }, [tidFromQuery, hydrated]);

  // save
  useEffect(() => {
    if (!hydrated) return;
    const id = window.setTimeout(() => {
      if (DEBUG) console.time("save");
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeEventsByThread(eventsByThread)));
      } catch {
        // ignore
      } finally {
        if (DEBUG) console.timeEnd("save");
      }
    }, 250);

    return () => window.clearTimeout(id);
  }, [eventsByThread, hydrated]);

  // 生年月日 restore
  useEffect(() => {
    try {
      const v = localStorage.getItem(LS_BIRTHDATE_KEY);
      if (v && isValidISODate(v)) setBirthdate(v);
    } catch {
      // ignore
    }
  }, []);

  // 生年月日 save
  useEffect(() => {
    try {
      if (birthdate && isValidISODate(birthdate)) localStorage.setItem(LS_BIRTHDATE_KEY, birthdate);
      else localStorage.removeItem(LS_BIRTHDATE_KEY);
    } catch {
      // ignore
    }
  }, [birthdate]);

  // フィルター開いたタイミングでタグ取得
  useEffect(() => {
    if (!isFilterOpen) return;
    if (goriyakuTags.length > 0) return;

    let alive = true;
    setTagsLoading(true);

    (async () => {
      try {
        const res = await getGoriyakuTags();
        if (!alive) return;
        setGoriyakuTags(Array.isArray(res) ? res : []);
        setTagsError(null);
      } catch {
        if (!alive) return;
        setTagsError("ご利益タグの取得に失敗しました");
      } finally {
        if (alive) setTagsLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [isFilterOpen, goriyakuTags.length]);

  // dev force
  const force = sp.get("force");
  const forced: StopReason = force === "design" ? "design" : force === "paywall" ? "paywall" : null;

  const events = useMemo(() => getThreadEvents(eventsByThread, activeThreadId), [eventsByThread, activeThreadId]);

  const recommendations = useMemo(() => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type !== "assistant_state") continue;
      const recs = e.unified?.data?.recommendations;
      if (Array.isArray(recs)) return recs;
    }
    return [];
  }, [events]);

  const debugRecN = useMemo(() => {
    if (process.env.NODE_ENV === "production") return 0;
    const n = Number(sp.get("recs") ?? "0");
    return Number.isFinite(n) ? Math.max(0, Math.min(3, n)) : 0;
  }, [sp]);

  const element4 = useMemo(() => (birthdate ? birthdateToElement4(birthdate) : null), [birthdate]);

  const suggestedTags = useMemo(() => {
    if (!element4) return [];
    if (!Array.isArray(goriyakuTags) || goriyakuTags.length === 0) return [];

    const names = ELEMENT_TO_GORIYAKU[element4] ?? [];
    const setNames = new Set(names);
    return goriyakuTags.filter((t) => setNames.has(t.name));
  }, [element4, goriyakuTags]);

  // dev用のダミー（未応答でもUI確認できるように）
  const devDummyRecs = useMemo(() => {
    if (process.env.NODE_ENV === "production") return [];
    const long =
      "これは長文の理由です。表示崩れ（高さ・改行・ボタン位置）が起きないか確認するためのダミーテキストです。".repeat(
        6,
      );

    return [
      {
        id: null,
        name: "（ダミー）明治神宮",
        display_name: "（ダミー）明治神宮",
        display_address: "東京都渋谷区代々木神園町1-1",
        reason: long,
        photo_url: null,
        distance_m: 1234,
        duration_min: 18,
        place_id: "dummy-place-1",
      },
      {
        id: null,
        name: "（ダミー）伏見稲荷大社",
        display_name: "（ダミー）伏見稲荷大社",
        display_address: "京都府京都市伏見区深草薮之内町68",
        reason: "短い理由。",
        photo_url: null,
        distance_m: 4321,
        duration_min: 55,
        place_id: "dummy-place-2",
      },
      {
        id: null,
        name: "（ダミー）鶴岡八幡宮",
        display_name: "（ダミー）鶴岡八幡宮",
        display_address: "神奈川県鎌倉市雪ノ下2-1-31",
        reason: long,
        photo_url: null,
        distance_m: 9876,
        duration_min: 120,
        place_id: "dummy-place-3",
      },
    ];
  }, []);

  const recommendationsView = useMemo(() => {
    const base = recommendations.length > 0 ? recommendations : devDummyRecs;
    if (!debugRecN) return base;
    return base.slice(0, debugRecN);
  }, [recommendations, devDummyRecs, debugRecN]);

  const lastUnified = useMemo((): UnifiedConciergeResponse | null => {
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.type === "assistant_state") return e.unified;
    }
    return null;
  }, [events]);

  const needTags = useMemo(() => {
    const tags = lastUnified?.data?._need?.tags;
    return Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
  }, [lastUnified]);

  const sections = useMemo(() => {
    return buildConciergeSections(recommendationsView as any, needTags);
  }, [recommendationsView, needTags]);

  const thread: ConciergeThread | null = useMemo(() => {
    const t = lastUnified?.thread;
    return t && typeof t.id === "number" ? t : null;
  }, [lastUnified]);

  const payload = useMemo(() => {
    return buildPayloadFromUnified(lastUnified) ?? DUMMY_SECTIONS;
  }, [lastUnified]);

  const threadIdNum = thread?.id ?? activeThreadId;
  const messages = useMemo(() => deriveMessages(events, threadIdNum), [events, threadIdNum]);

  const chatThreadId: string | null =
    typeof thread?.id === "number" && thread.id > 0
      ? String(thread.id)
      : activeThreadId !== 0
        ? String(activeThreadId)
        : null;

  const { send, sending, error } = useConciergeChat(chatThreadId, {
    onUnified: (u) => {
      const now = new Date().toISOString();
      const nextTid = typeof u.thread?.id === "number" ? u.thread.id : 0;
      const currentTid = activeThreadIdRef.current;

      if (currentTid === 0 && nextTid !== 0) {
        setActiveTid(nextTid);
        setPromotedTid(nextTid);
      }

      setEventsByThread((prev) => {
        let cur = prev;
        if (currentTid === 0 && nextTid !== 0) cur = promoteThread(cur, 0, nextTid);

        const tidToWrite = nextTid !== 0 ? nextTid : currentTid;
        const nextEvents: ChatEvent[] = [
          { type: "assistant_state", unified: u, at: now },
          ...(typeof u.reply === "string" && u.reply.trim()
            ? [{ type: "assistant_reply", text: u.reply, at: now } as const]
            : []),
        ];
        return appendEvents(cur, tidToWrite, nextEvents);
      });
    },
  });

  const isDevForced = process.env.NODE_ENV !== "production" && !!forced;
  const stopReason: StopReason = isDevForced ? (forced as StopReason) : (lastUnified?.stop_reason ?? null);
  const canSend = stopReason === null || isDevForced;

  // JSON固定で送る用（thread_idは hooks 側で注入される前提）
  const buildFilterPayload = (): Omit<ConciergeChatRequestV1, "thread_id"> | null => {
    const extra = extraCondition.trim();
    const bd = birthdate && isValidISODate(birthdate) ? birthdate : undefined;

    const filters: ConciergeChatFilters = {
      goriyaku_tag_ids: selectedTagIds.length ? selectedTagIds : undefined,
      birthdate: bd,
      extra_condition: extra ? extra : undefined,
    };

    const hasFilter = (filters.goriyaku_tag_ids?.length ?? 0) > 0 || !!filters.birthdate || !!filters.extra_condition;

    if (!hasFilter) return null;

    return {
      version: 1,
      query: "条件を追加して絞り込みたいです。",
      filters,
    };
  };

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!canSend) return;

    const now = new Date().toISOString();
    const tid = activeThreadId !== 0 ? activeThreadId : activeThreadIdRef.current;

    setEventsByThread((prev) => appendEvents(prev, tid, { type: "user_message", text: trimmed, at: now } as const));
    void send(trimmed);
  };

  useEffect(() => {
    if (!promotedTid) return;
    router.replace(`/concierge?tid=${promotedTid}`);
    setPromotedTid(null);
  }, [promotedTid, router]);

  const SHOW_NEW_RENDERER = process.env.NODE_ENV !== "production";

  return (
    <ConciergeLayout
      messages={messages}
      sending={sending}
      error={error}
      onSend={handleSend}
      onNewThread={() => setActiveTid(0)}
      canSend={canSend}
      embedMode={false}
    >
      {SHOW_NEW_RENDERER ? (
        <div className="p-4 space-y-3">
          {isFilterOpen ? (
            <section className="mx-auto w-full max-w-md min-w-0 rounded-xl border bg-white p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">条件を追加して絞る</div>
                <button
                  type="button"
                  className="text-[11px] font-semibold text-slate-600 hover:underline"
                  onClick={() => setIsFilterOpen(false)}
                >
                  閉じる
                </button>
              </div>

              {/* 相性のヒント（任意） */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">相性のヒント（任意）</div>

                <div className="grid gap-2">
                  <input
                    type="date"
                    value={birthdate}
                    onChange={(e) => setBirthdate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 text-sm"
                    aria-label="生年月日"
                  />

                  {element4 ? (
                    <div className="text-xs text-slate-600">
                      あなたの傾向：<span className="font-semibold">{element4}</span>（参考）
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-500">
                      入力するとおすすめ条件を提案します（自動適用はしません）
                    </div>
                  )}

                  {element4 && suggestedTags.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {suggestedTags.map((t) => {
                        const on = selectedTagIds.includes(t.id);
                        return (
                          <button
                            key={`suggest-${t.id}`}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                              on ? "bg-emerald-50 border-emerald-600" : "bg-white"
                            }`}
                            onClick={() => {
                              setSelectedTagIds((prev) => (prev.includes(t.id) ? prev : [...prev, t.id]));
                            }}
                          >
                            おすすめ {t.name}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ご利益 */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">ご利益</div>
                {tagsError ? <div className="text-xs text-red-600">{tagsError}</div> : null}
                {tagsLoading ? <div className="text-xs text-slate-500">読み込み中…</div> : null}

                <div className="flex flex-wrap gap-2">
                  {goriyakuTags.map((t) => {
                    const on = selectedTagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          on ? "bg-emerald-50 border-emerald-600" : "bg-white"
                        }`}
                        onClick={() => {
                          setSelectedTagIds((prev) =>
                            prev.includes(t.id) ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                          );
                        }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 補足条件 */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">補足条件</div>
                <textarea
                  value={extraCondition}
                  onChange={(e) => setExtraCondition(e.target.value)}
                  placeholder="例：静かな雰囲気、階段が少ない、など"
                  className="w-full rounded-xl border p-3 text-sm"
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-xl border px-4 py-2 text-sm font-semibold"
                  onClick={() => {
                    setExtraCondition("");
                    setSelectedTagIds([]);
                    setIsFilterOpen(false);
                  }}
                >
                  クリア
                </button>

                <button
                  type="button"
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                  onClick={() => {
                    const p = buildFilterPayload();
                    if (!p) return;
                    setIsFilterOpen(false);

                    // NOTE: hooks.ts が send(string) しか受けない場合はここが型エラーになる。
                    // hooks側を union対応にしたらこのanyキャストは削除してOK。
                    void send(p);
                  }}
                >
                  この条件で絞る
                </button>
              </div>
            </section>
          ) : null}

          <ConciergeSectionsRenderer
            payload={payload}
            onAction={(action) => {
              if (action === "open_map") router.push("/map");
              if (action === "add_condition") setIsFilterOpen(true);
            }}
          />
        </div>
      ) : (
        <ConciergeSections sections={sections} onNewThread={() => setActiveTid(0)} />
      )}
    </ConciergeLayout>
  );
}

function sanitizeUnified(u: UnifiedConciergeResponse): UnifiedConciergeResponse {
  return {
    ok: u.ok,
    reply: u.reply ?? null,
    stop_reason: u.stop_reason ?? null,
    note: u.note ?? null,
    remaining_free: u.remaining_free ?? null,
    thread: u.thread ? ({ id: (u.thread as any).id } as any) : null,
    data: {
      recommendations: (u.data as any)?.recommendations ?? [],
      _need: { tags: (u.data as any)?._need?.tags ?? [] },
    } as any,
  } as any;
}

function sanitizeEventsByThread(map: EventsByThread): EventsByThread {
  const next: EventsByThread = {};
  for (const [k, events] of Object.entries(map)) {
    const tid = Number(k);
    next[tid] = events.map((e) => {
      if (e.type !== "assistant_state") return e;
      if (!e.unified) return e;
      return { ...e, unified: sanitizeUnified(e.unified as any) } as any;
    });
  }
  return next;
}
