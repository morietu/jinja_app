"use client";

// Compass MVP client (docs/product/compass-product-contract.md,
// docs/product/compass-mvp-runtime-contract.md, Phase 5 brief).
//
// No free-text consultation input here (Phase 5 brief Section 4) -- that
// belongs to Concierge. This screen collects only: purpose (chip select),
// origin (reused OriginSelector), birthdate, then calls the
// Compass BFF and renders one of the backend's 5 fail-safe states plus
// this component's own pre-submit states (birthdate/origin missing).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DetailSection from "@/components/shrine/DetailSection";
import { trackSearchEvent } from "@/lib/analytics/searchEvents";
import { requestCurrentPosition } from "@/lib/geo/currentPosition";
import type { UserOrigin } from "../../../../../packages/shared/userOrigin";
import { toOriginPayload } from "../../../../../packages/shared/userOrigin";
import CompassDirectionVisual from "./components/CompassDirectionVisual";
import CompassOriginSummary from "./components/CompassOriginSummary";
import CompassPurposeSelector from "./components/CompassPurposeSelector";
import CompassRecommendationsSection from "./components/CompassRecommendationsSection";
import type { CompassDirectionRuntime, CompassPurpose, CompassRecommendationsResponse, CompassUiState } from "./types";

// Compass lifecycle analytics (PR-A,
// docs/audit/compass-analytics-contract-readiness.md §6-10). Only the
// backend orchestrator's own state strings are used -- never renamed for
// analytics convenience -- plus the frontend-only "backend_error" bucket
// already used by this component's own uiState for network failures and
// non-400 error responses.
type CompassResultState =
  | "invalid_purpose"
  | "direction_filter_unavailable"
  | "no_common_direction"
  | "recommendation_eligibility_zero_candidates"
  | "direction_zero_candidates"
  | "evidence_zero_candidates"
  | "recommendation_success"
  | "backend_error";

type CompassClientProps = {
  savedBirthday?: string | null;
  isLoggedIn?: boolean;
  onPersistBirthday?: (birthday: string) => void;
};

type BirthdateParts = {
  year: string;
  month: string;
  day: string;
};

function parseBirthdate(value: string | null | undefined): BirthdateParts {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { year: match[1], month: match[2], day: match[3] } : { year: "", month: "", day: "" };
}

function isValidBirthdate({ year, month, day }: BirthdateParts): boolean {
  if (!/^\d{4}$/.test(year) || !/^\d{2}$/.test(month) || !/^\d{2}$/.test(day)) return false;

  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  if (numericMonth < 1 || numericMonth > 12 || numericDay < 1) return false;

  const isLeapYear = numericYear % 4 === 0 && (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return numericDay <= daysInMonth[numericMonth - 1];
}

function formatBirthdate({ year, month, day }: BirthdateParts): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatTargetMonth(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

// Product Contract Section 2.2-7 / Runtime Contract Section 5-1 (#2508
// Option C, audited in docs/audit/compass-monthly-fallback-ui-analytics-boundary.md
// Section 9): a Monthly Fallback direction must never be presented as if it
// were annual/monthly agreement. The backend's direction_context.note is a
// fixed constant identical for both calculationMethod values (Signal-to-
// Explanation Rule violation for the fallback case), so this copy is
// derived here from calculationMethod instead of rendering note directly.
function getDirectionNote(calculationMethod: CompassDirectionRuntime["calculationMethod"]): string {
  if (calculationMethod === "monthly_kyusei_v1") {
    return "年盤と月盤で重なる方位がないため、今月の月盤を参考にした方位です。日盤は使用していません。";
  }
  return "年盤と月盤の両方で重なる、今月の参考方位です。日盤は使用していません。";
}

// Result Experience audit (docs/audit/compass-result-experience.md Section
// 26-1, P1 finding): COMMON and MONTHLY_FALLBACK carry correct but
// visually-identical copy -- a user who does not read getDirectionNote()
// closely cannot tell them apart. This small label, derived only from
// calculationMethod (never from direction count/copy/result_state, per the
// follow-up definition's own constraint), gives an at-a-glance distinction
// without reading the note. Deliberately calm/equal-weight for both values
// -- same pill style, same size -- so neither reads as stronger, more
// certain, or more alarming than the other; MONTHLY_FALLBACK is a
// legitimate result, not a degraded one (compass-product-contract.md
// Section 2.2-3). Returns null (renders nothing) for any value other than
// the two known ones, rather than defaulting to a COMMON-looking label --
// unlike getDirectionNote() above, this never fabricates a classification.
function getDirectionStatusLabel(calculationMethod: CompassDirectionRuntime["calculationMethod"]): string | null {
  if (calculationMethod === "annual_monthly_kyusei_v1") {
    return "年盤・月盤 共通";
  }
  if (calculationMethod === "monthly_kyusei_v1") {
    return "今月の月盤を参考";
  }
  return null;
}

export default function CompassClient({
  savedBirthday = null,
  isLoggedIn = false,
  onPersistBirthday,
}: CompassClientProps = {}) {
  const [now] = useState(() => new Date());
  const [purpose, setPurpose] = useState<CompassPurpose | null>(null);
  const [birthdateParts, setBirthdateParts] = useState<BirthdateParts>(() => parseBirthdate(savedBirthday));
  const [origin, setOrigin] = useState<UserOrigin | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [uiState, setUiState] = useState<CompassUiState>("initial");
  const [result, setResult] = useState<CompassRecommendationsResponse | null>(null);

  const searchParams = useSearchParams();
  const entryTrackedRef = useRef(false);
  const birthdateEditedRef = useRef(false);
  const birthdateYearRef = useRef<HTMLInputElement>(null);
  const birthdateMonthRef = useRef<HTMLInputElement>(null);
  const birthdateDayRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!savedBirthday || birthdateEditedRef.current) return;
    setBirthdateParts(parseBirthdate(savedBirthday));
  }, [savedBirthday]);

  useEffect(() => {
    if (entryTrackedRef.current) return;
    entryTrackedRef.current = true;

    trackSearchEvent("compass_entry", {
      referrer_source: searchParams.get("ref") === "home" ? "home" : "direct",
    });
    // Fires once for the actual Compass entry only -- entryTrackedRef guards
    // against React re-render/StrictMode double-invocation the same way
    // ShrineDetailViewTracker.tsx does for shrine_detail_view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trackCompassResult = (
    resultState: CompassResultState,
    recommendationCount: number | null = null,
    recommendationInstanceId: string | null = null,
    calculationMethod: CompassDirectionRuntime["calculationMethod"] | null = null,
    distanceStageKm: 15 | 30 | 60 | null = null,
    directionCandidateCount: number | null = null,
    distanceCandidateCount: number | null = null,
  ) => {
    trackSearchEvent("compass_result", {
      result_state: resultState,
      purpose,
      origin_mode: origin?.source ?? null,
      has_birthdate: true,
      recommendation_count: recommendationCount,
      recommendationInstanceId,
      calculationMethod,
      distance_stage_km: distanceStageKm,
      direction_candidate_count: directionCandidateCount,
      distance_candidate_count: distanceCandidateCount,
    });
  };

  const useDevice = async () => {
    setDeviceError(null);
    const result = await requestCurrentPosition();
    if (result.ok) {
      setOrigin({
        latitude: result.lat,
        longitude: result.lng,
        source: "device",
        accuracy: "precise",
      });
      return;
    }
    // Fail-safe copy: one fixed lead sentence for every failure, plus a hint only
    // where it adds something the user can act on. The alternative route is
    // OriginSelector's own 「駅名・住所から指定」 radio, so it is not repeated here.
    // The reason branches are requestCurrentPosition's classification used as-is --
    // this only changes wording, never how a GeolocationPositionError is classified.
    setDeviceError(
      result.reason === "unsupported"
        ? "現在地を取得できませんでした。この端末では利用できません。"
        : result.reason === "denied"
          ? "現在地を取得できませんでした。位置情報の許可を確認してください。"
          : "現在地を取得できませんでした。",
    );
  };

  const hasBirthdateInput = Object.values(birthdateParts).some(Boolean);
  const validBirthdate = isValidBirthdate(birthdateParts);
  const missingBirthdate = attempted && !hasBirthdateInput;
  const invalidBirthdate = attempted && hasBirthdateInput && !validBirthdate;
  const missingOrigin = attempted && !origin;
  const missingPurpose = attempted && !purpose;

  const handleSubmit = async () => {
    setAttempted(true);
    if (!purpose || !validBirthdate || !origin) {
      return;
    }

    const submittedBirthdate = formatBirthdate(birthdateParts);

    setUiState("loading");
    setResult(null);

    try {
      const res = await fetch("/api/compass/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          birthdate: submittedBirthdate,
          origin: toOriginPayload(origin),
        }),
      });

      if (!res.ok && res.status !== 400) {
        setUiState("backend_error");
        trackCompassResult("backend_error");
        return;
      }

      const body = (await res.json()) as CompassRecommendationsResponse;
      setResult(body);
      setUiState(body.state);

      // A structured Compass result means this birthday was actually submitted
      // for the direction/recommendation flow. Persistence is delegated to the
      // Shared Context boundary and never awaited here, so result rendering wins.
      if (isLoggedIn && body.state !== "invalid_purpose") {
        onPersistBirthday?.(submittedBirthdate);
      }

      trackCompassResult(
        body.state,
        body.state === "recommendation_success" ? (body.recommendations?.length ?? 0) : null,
        body.recommendation_instance_id,
        body.direction_context?.calculationMethod ?? null,
        body.distance_stage_km ?? null,
        body.direction_candidate_count ?? null,
        body.distance_candidate_count ?? null,
      );
    } catch {
      setUiState("backend_error");
      trackCompassResult("backend_error");
    }
  };

  const isLoading = uiState === "loading";
  const directionContext = result?.direction_context ?? null;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
      {/* DetailSection titles render as h2 (shared component, matches
          Concierge/Shrine Detail's existing outline); this page-level h1
          is sr-only so the visual heading stays exactly as designed while
          giving the document a correct heading hierarchy for screen readers
          (Phase 6 QA finding, docs/audit/compass-full-experience-qa.md). */}
      <h1 className="sr-only">今月の参拝コンパス</h1>
      <DetailSection title="今月の参拝コンパス" variant="primary" right={formatTargetMonth(now)}>
        <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
          今月の流れと目的から、向かう方向と参拝候補を見つけます。
        </p>
      </DetailSection>

      <DetailSection title="目的と出発地点" variant="secondary">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <CompassPurposeSelector value={purpose} onChange={setPurpose} />
            {missingPurpose ? (
              <p role="alert" className="text-sm text-[var(--kt-color-status-error)]">
                目的を選択してください。
              </p>
            ) : null}
          </div>

          <CompassOriginSummary
            origin={origin}
            onChange={setOrigin}
            onUseDevice={useDevice}
            deviceError={deviceError}
          />
          {missingOrigin ? (
            <p role="alert" className="text-sm text-[var(--kt-color-status-error)]">
              出発地点を選択してください。
            </p>
          ) : null}

          <div className="space-y-1.5">
            <p className="text-sm font-medium text-[var(--kt-color-text-secondary)]">生年月日（方位計算に使用）</p>
            <div className="flex items-center gap-2" role="group" aria-label="生年月日">
              <input
                ref={birthdateYearRef}
                type="text"
                inputMode="numeric"
                maxLength={4}
                placeholder="YYYY"
                aria-label="生年月日の年"
                value={birthdateParts.year}
                onChange={(event) => {
                  birthdateEditedRef.current = true;
                  const year = event.target.value.replace(/\D/g, "").slice(0, 4);
                  setBirthdateParts((current) => ({ ...current, year }));
                  if (year.length === 4) birthdateMonthRef.current?.focus();
                }}
                className="min-h-11 min-w-0 flex-1 rounded-[var(--kt-radius-control)] border border-[var(--kt-color-border-default)] px-3 py-2 text-center text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
              <span aria-hidden="true" className="text-sm text-[var(--kt-color-text-secondary)]">
                年
              </span>
              <input
                ref={birthdateMonthRef}
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="MM"
                aria-label="生年月日の月"
                value={birthdateParts.month}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !birthdateParts.month) birthdateYearRef.current?.focus();
                }}
                onChange={(event) => {
                  birthdateEditedRef.current = true;
                  const month = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setBirthdateParts((current) => ({ ...current, month }));
                  if (month.length === 2 && Number(month) >= 1 && Number(month) <= 12) birthdateDayRef.current?.focus();
                }}
                className="min-h-11 min-w-0 flex-1 rounded-[var(--kt-radius-control)] border border-[var(--kt-color-border-default)] px-3 py-2 text-center text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
              <span aria-hidden="true" className="text-sm text-[var(--kt-color-text-secondary)]">
                月
              </span>
              <input
                ref={birthdateDayRef}
                type="text"
                inputMode="numeric"
                maxLength={2}
                placeholder="DD"
                aria-label="生年月日の日"
                value={birthdateParts.day}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !birthdateParts.day) birthdateMonthRef.current?.focus();
                }}
                onChange={(event) => {
                  birthdateEditedRef.current = true;
                  const day = event.target.value.replace(/\D/g, "").slice(0, 2);
                  setBirthdateParts((current) => ({ ...current, day }));
                }}
                className="min-h-11 min-w-0 flex-1 rounded-[var(--kt-radius-control)] border border-[var(--kt-color-border-default)] px-3 py-2 text-center text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              />
              <span aria-hidden="true" className="text-sm text-[var(--kt-color-text-secondary)]">
                日
              </span>
            </div>
            {isLoggedIn ? (
              <p className="text-xs text-[var(--kt-color-text-muted)]">
                ログイン中は次回以降も利用できるよう保存されます。
              </p>
            ) : null}
            {missingBirthdate ? (
              <p role="alert" className="text-sm text-[var(--kt-color-status-error)]">
                生年月日を入力してください。
              </p>
            ) : null}
            {invalidBirthdate ? (
              <p role="alert" className="text-sm text-[var(--kt-color-status-error)]">
                正しい生年月日を入力してください。
              </p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLoading}
            className="min-h-11 w-full rounded-[var(--kt-radius-pill)] bg-[var(--kt-color-action-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--kt-color-action-primary-text)] transition hover:bg-[var(--kt-color-action-primary-hover)] disabled:bg-[var(--kt-color-action-disabled)] disabled:text-[var(--kt-color-text-muted)]"
          >
            {isLoading ? "確認しています…" : "今月の方向を確認する"}
          </button>
        </div>
      </DetailSection>

      {directionContext ? (
        <DetailSection
          title="今月、意識したい方向"
          variant="secondary"
          right={
            getDirectionStatusLabel(directionContext.calculationMethod) ? (
              <span className="rounded-full bg-[var(--kt-color-background-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--kt-color-text-secondary)]">
                {getDirectionStatusLabel(directionContext.calculationMethod)}
              </span>
            ) : undefined
          }
        >
          <div className="space-y-3">
            <CompassDirectionVisual referenceDirections={directionContext.referenceDirections} />
            <p className="text-center text-xs text-[var(--kt-color-text-muted)]">
              {getDirectionNote(directionContext.calculationMethod)}（参考情報です）
            </p>
          </div>
        </DetailSection>
      ) : null}

      {uiState === "direction_filter_unavailable" ? (
        <DetailSection title="方向の参考情報を計算できませんでした" variant="tertiary">
          <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
            生年月日または出発地点をご確認のうえ、もう一度お試しください。
          </p>
        </DetailSection>
      ) : null}

      {uiState === "no_common_direction" ? (
        <DetailSection title="今月は方位の参考情報がありません" variant="tertiary">
          <div className="space-y-3">
            <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
              生年月日・出発地点はどちらも問題ありません。年盤と月盤の共通方位も、今月の月盤単独の参考方位も、今月はいずれもありませんでした。
            </p>
            {/* Result Experience audit (docs/audit/compass-result-experience.md
                Section 26-2, P2 finding): a legitimate result must not be a
                dead end. Reuses the existing, already-established /concierge
                route (same plain Link pattern app/shrines/page.tsx already
                uses to point elsewhere in the product toward Concierge) --
                no new route, no query params, no Compass personal input
                (birthdate/origin/purpose) forwarded. This is the one primary
                continuation; retrying identical inputs is never suggested. */}
            <Link
              href="/concierge"
              className="inline-flex min-h-11 items-center rounded-[var(--kt-radius-pill)] border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 py-2 text-sm font-semibold text-[var(--kt-color-text-secondary)] hover:bg-[var(--kt-color-background-subtle)]"
            >
              コンシェルジュで相談する
            </Link>
          </div>
        </DetailSection>
      ) : null}

      {/* Shared Recommendation Eligibility gateが候補を全て除外した状態
          (docs/knowledge/recommendation-eligibility-contract.md)。
          backend error でも direction failure でもなく、
          direction_zero_candidates / evidence_zero_candidates とも
          別の正常なproduct resultとして表示する。既存の空結果表示
          (DetailSection variant="tertiary") をそのまま再利用し、
          no_common_direction と同じ /concierge 導線だけを添える。 */}
      {uiState === "recommendation_eligibility_zero_candidates" ? (
        <DetailSection title="ご案内できる参拝候補がまだありません" variant="tertiary">
          <div className="space-y-3">
            <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
              現在の条件では、ご案内に必要な情報を確認できる神社が見つかりませんでした。
            </p>
            <Link
              href="/concierge"
              className="inline-flex min-h-11 items-center rounded-[var(--kt-radius-pill)] border border-[var(--kt-color-border-default)] bg-[var(--kt-color-surface-default)] px-4 py-2 text-sm font-semibold text-[var(--kt-color-text-secondary)] hover:bg-[var(--kt-color-background-subtle)]"
            >
              コンシェルジュで相談する
            </Link>
          </div>
        </DetailSection>
      ) : null}

      {uiState === "direction_zero_candidates" ? (
        <DetailSection title="この方向の参拝候補が見つかりませんでした" variant="tertiary">
          <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
            出発地点を変えると、見つかることがあります。
          </p>
        </DetailSection>
      ) : null}

      {uiState === "evidence_zero_candidates" ? (
        <DetailSection title="参拝候補の情報を確認できませんでした" variant="tertiary">
          <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
            しばらくしてから、もう一度お試しください。
          </p>
        </DetailSection>
      ) : null}

      {uiState === "backend_error" ? (
        <DetailSection title="只今、確認できませんでした" variant="tertiary">
          <p className="text-sm leading-6 text-[var(--kt-color-text-secondary)]">
            時間をおいて、もう一度お試しください。
          </p>
        </DetailSection>
      ) : null}

      {uiState === "recommendation_success" && result ? (
        <CompassRecommendationsSection
          recommendations={result.recommendations}
          recommendationInstanceId={result.recommendation_instance_id}
          purpose={purpose}
        />
      ) : null}
    </div>
  );
}
