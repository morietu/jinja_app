// apps/web/src/features/concierge/buildConciergeRequestPayload.ts
//
// Pure extraction of the request-payload-building logic previously inlined
// as a useCallback in apps/web/src/app/concierge/ConciergeClientFull.tsx.
// Byte-for-byte identical output for identical inputs -- this is a
// mechanical move (closure variables become explicit params), not a
// contract change. Extracted so the Concierge Entry Frontend IA v2
// reorganization (docs/product/concierge-input-architecture.md, Frontend
// IA Implementation Addendum) can be covered by fast unit tests without
// rendering the full ConciergeClientFull component tree.
//
// Level tagging on the returned fields follows
// apps/web/src/features/concierge/types/chatRequest.ts.
import { normalizeBirthdateInput } from "@/lib/date/normalizeBirthdateInput";
import { buildProfileContext, normalizeBirthday as normalizeProfileBirthday, type ProfileInput } from "@/lib/profile/derivedProfile";
import type { ConciergeChatFilters, ConciergeChatRequestV1 } from "@/features/concierge/types/chatRequest";
import { toOriginPayload, type UserOrigin } from "../../../../../packages/shared/userOrigin";

function isBirthdateOnlyText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return normalizeBirthdateInput(trimmed) !== null;
}

export function normalizeQueryText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (isBirthdateOnlyText(trimmed)) return "";
  return trimmed;
}

export type BuildConciergeRequestPayloadInput = Partial<Omit<ConciergeChatRequestV1, "thread_id">> & {
  query?: string;
  crowd?: ConciergeChatFilters["crowd"];
  duration_max_min?: number;
  free_text?: string;
};

export type BuildConciergeRequestPayloadParams = {
  // Level 1 Consultation
  needText: string;
  // Level 3-A Personal Profile
  temporaryBirthdate: string | null | undefined;
  savedProfile?: ProfileInput | null;
  // Level 2 (extra_condition/crowd/duration_max_min) + Level 3-A (birthdate) +
  // Level 3-B (goriyaku_tag_ids) baseline, already resolved by the caller
  // (ConciergeClientFull's `baseFilters` memo -- unchanged by this extraction).
  baseFilters: ConciergeChatFilters;
  // Level 2 Visit Preference (Structured)
  visitPreferences: readonly string[];
  // Level 3-C Recommendation Context
  plannedVisitDate: string;
  userOrigin: UserOrigin | null;
  // Per-call override (e.g. filter_apply / example pick), same shape as the
  // original inline function accepted.
  input?: BuildConciergeRequestPayloadInput;
};

export function buildConciergeRequestPayload({
  needText,
  temporaryBirthdate,
  savedProfile,
  baseFilters,
  visitPreferences,
  plannedVisitDate,
  userOrigin,
  input,
}: BuildConciergeRequestPayloadParams): Omit<ConciergeChatRequestV1, "thread_id"> {
  const birthdate = normalizeBirthdateInput(temporaryBirthdate ?? "") ?? normalizeProfileBirthday(savedProfile?.birthday);
  const payloadBirthdate = input?.birthdate ?? birthdate;
  const payloadGoriyakuTagIds = input?.goriyaku_tag_ids ?? baseFilters.goriyaku_tag_ids;
  const payloadExtraCondition = input?.extra_condition ?? baseFilters.extra_condition;
  const payloadVisitPreferences = input?.visit_preferences ?? (visitPreferences.length ? [...visitPreferences] : undefined);
  const payloadCrowd = input?.crowd ?? baseFilters.crowd;
  const payloadDurationMaxMin = input?.duration_max_min ?? baseFilters.duration_max_min;
  const payloadFreeText = input?.free_text ?? input?.extra_condition ?? baseFilters.free_text;
  const rawQuery = normalizeQueryText(input?.query ?? needText);
  const hasPayloadFilter =
    !!payloadBirthdate ||
    (payloadGoriyakuTagIds?.length ?? 0) > 0 ||
    !!payloadExtraCondition ||
    !!payloadCrowd?.length ||
    typeof payloadDurationMaxMin === "number" ||
    !!payloadFreeText;
  const query = rawQuery || (hasPayloadFilter ? "追加した条件に合う神社を提案してください。" : "");

  return {
    version: input?.version ?? 1,
    mode: input?.mode ?? "need",
    query,
    birthdate: payloadBirthdate,
    filters: {
      birthdate: payloadBirthdate,
      goriyaku_tag_ids: payloadGoriyakuTagIds,
      extra_condition: payloadExtraCondition,
      crowd: payloadCrowd,
      duration_max_min: payloadDurationMaxMin,
      free_text: payloadFreeText,
    },
    goriyaku_tag_ids: payloadGoriyakuTagIds,
    extra_condition: payloadExtraCondition,
    visit_preferences: payloadVisitPreferences,
    visit_date: plannedVisitDate || undefined,
    location: toOriginPayload(userOrigin),
    profile_context: buildProfileContext({
      birthday: payloadBirthdate,
      birth_time: savedProfile?.birth_time,
      birth_place: savedProfile?.birth_place,
    }),
  };
}
