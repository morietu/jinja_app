import { buildDerivedProfile } from "./profile";
import { get } from "./http";
import type { UserProfile } from "../types/profile";

// 条件レイヤーUI（Home / Concierge結果画面で共通）の選択肢
export const VISIT_STYLE_OPTIONS = [
  "静かに整えたい",
  "人混みを避けたい",
  "近場を優先したい",
  "自然を感じたい",
] as const;

export const GORIYAKU_OPTIONS = ["仕事運", "金運", "縁結び", "厄除け", "学業成就", "健康"] as const;

// UIの参拝スタイル選択肢 → backend の extra_condition_tags.py が認識する visit_style キー
export const VISIT_STYLE_TAG_BY_LABEL: Record<string, string> = {
  "静かに整えたい": "quiet",
  "人混みを避けたい": "less_crowded",
  "近場を優先したい": "nearby",
  "自然を感じたい": "nature",
};

type GoriyakuTagIndexEntry = { id: number; name: string };

let goriyakuTagIndexPromise: Promise<GoriyakuTagIndexEntry[]> | null = null;

function fetchGoriyakuTagIndex(): Promise<GoriyakuTagIndexEntry[]> {
  if (!goriyakuTagIndexPromise) {
    goriyakuTagIndexPromise = get<GoriyakuTagIndexEntry[]>("/goriyaku-tags/").catch((error) => {
      goriyakuTagIndexPromise = null;
      throw error;
    });
  }
  return goriyakuTagIndexPromise;
}

// UIのご利益ラベル（例:「厄除け」）→ backend GoriyakuTag.id へ解決する。
// Home / Concierge結果画面のどちらから呼んでもキャッシュを共有する。
export async function resolveGoriyakuTagIds(label: string | undefined): Promise<number[] | undefined> {
  if (!label) return undefined;

  try {
    const tags = await fetchGoriyakuTagIndex();
    // 完全一致を優先する。前方一致だけで探すと「厄除け・方除け」のような
    // 旧・複合ラベル（id順で先に来るが紐づく神社が無い場合がある）に
    // 誤ってマッチし、候補が0件になることがあるため。
    const matched = tags.find((tag) => tag.name === label) ?? tags.find((tag) => tag.name.startsWith(label));
    return matched ? [matched.id] : undefined;
  } catch {
    if (__DEV__) {
      console.warn("[conditionPayload] failed to resolve goriyaku_tag_ids", label);
    }
    return undefined;
  }
}

export type ConditionState = {
  birthdate?: string;
  plannedVisitDate?: string;
  visitStyleLabel?: string;
  goriyakuLabel?: string;
  goriyakuTagIds?: number[];
  supportText?: string;
};

export type ConditionFilters = {
  birthdate?: string;
  goriyaku_tag_ids?: number[];
  visit_style_tags?: string[];
  extra_condition?: string;
};

export type ProfileContextPayload = {
  user_profile: {
    birthday?: string;
    birthdate?: string;
    birthTime?: string;
    birthPlace?: string;
    goriyaku_tag_ids?: number[];
    visit_style_tags?: string[];
  };
  derived_profile: {
    kyusei?: string;
    gogyo?: string;
    lifePath?: string;
    raw_extra?: string;
  };
};

export function resolveVisitStyleTags(visitStyleLabel?: string): string[] | undefined {
  if (!visitStyleLabel) return undefined;
  const tag = VISIT_STYLE_TAG_BY_LABEL[visitStyleLabel];
  return tag ? [tag] : undefined;
}

export function buildExtraConditionText({
  visitStyleLabel,
  birthdate,
  plannedVisitDate,
  goriyakuLabel,
  supportText,
}: ConditionState): string {
  return [
    visitStyleLabel ? `参拝スタイル: ${visitStyleLabel}` : undefined,
    birthdate ? `誕生日: ${birthdate}` : undefined,
    plannedVisitDate ? `参拝予定日: ${plannedVisitDate}` : undefined,
    goriyakuLabel ? `ご利益: ${goriyakuLabel}` : undefined,
    supportText?.trim() ? `補助条件: ${supportText.trim()}` : undefined,
  ]
    .filter(Boolean)
    .join(" / ");
}

export function buildConditionFilters(condition: ConditionState): ConditionFilters {
  const normalizedBirthdate = condition.birthdate?.trim() || undefined;
  const extraCondition = buildExtraConditionText(condition) || undefined;

  return {
    birthdate: normalizedBirthdate,
    goriyaku_tag_ids: condition.goriyakuTagIds,
    visit_style_tags: resolveVisitStyleTags(condition.visitStyleLabel),
    extra_condition: extraCondition,
  };
}

// Concierge画面で入力した条件を優先し、未入力の個人情報だけ app全体のプロフィールで補う
export function buildConditionProfileContext({
  condition,
  globalUserProfile,
}: {
  condition: ConditionState;
  globalUserProfile: UserProfile;
}): ProfileContextPayload {
  const effectiveUserProfile: UserProfile = {
    birthday: condition.birthdate?.trim() || globalUserProfile.birthday,
    birthTime: globalUserProfile.birthTime,
    birthPlace: globalUserProfile.birthPlace,
  };

  const derived = buildDerivedProfile(effectiveUserProfile);
  const extraConditionText = buildExtraConditionText(condition) || undefined;

  return {
    user_profile: {
      birthday: effectiveUserProfile.birthday,
      birthdate: effectiveUserProfile.birthday,
      birthTime: effectiveUserProfile.birthTime,
      birthPlace: effectiveUserProfile.birthPlace,
      goriyaku_tag_ids: condition.goriyakuTagIds,
      visit_style_tags: resolveVisitStyleTags(condition.visitStyleLabel),
    },
    derived_profile: {
      kyusei: derived.kyusei,
      gogyo: derived.gogyo,
      lifePath: derived.lifePath,
      raw_extra: extraConditionText,
    },
  };
}
