import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({ trackSearchEvent: vi.fn(), trackCardEvent: vi.fn() }));
vi.mock("@/lib/analytics/searchEvents", () => ({ trackSearchEvent: analyticsMocks.trackSearchEvent }));
vi.mock("@/lib/analytics/cardEvents", () => ({ trackCardEvent: analyticsMocks.trackCardEvent }));
vi.mock("@/lib/auth/AuthProvider", () => ({ useAuth: () => ({ isLoggedIn: false, loading: false }) }));

import { buildPayloadFromUnified } from "@/features/concierge/buildPayloadFromUnified";
import { normalizeConciergeResponse } from "@/features/concierge/hooks";
import { normalizeRecommendations } from "@/lib/api/concierge/normalize";
import ConciergeSectionsRenderer from "../ConciergeSectionsRenderer";

const filterState: any = {
  isOpen: false,
  birthdate: "",
  element4: null,
  goriyakuTags: [],
  suggestedTags: [],
  selectedTagIds: [],
  tagsLoading: false,
  tagsError: null,
  extraCondition: "",
  visitPreferences: [],
  plannedVisitDate: "",
  userOrigin: null,
};

function fact(type: string, label: string, isPrimary = true) {
  return { type, label, evidence: [`${type}:${label}`], score: 1, ...(isPrimary ? { is_primary: true } : {}) };
}

function renderBackendResponse(recommendations: any[]) {
  const raw = { ok: true, data: { recommendations }, thread: { id: 2419 } };
  const recs = normalizeRecommendations(raw.data.recommendations);
  const unified = normalizeConciergeResponse(raw, recs);
  const payload = buildPayloadFromUnified(unified, filterState);
  if (!payload) throw new Error("payload should not be null");
  render(<ConciergeSectionsRenderer payload={payload} threadId={2419} isPremiumActive />);
  return { recs, unified, payload };
}

describe("Backend reason_facts[] end-to-end consumption", () => {
  beforeEach(() => window.localStorage.clear());

  it("API normalize → Unified → Renderer → Hero visible textへelement Primaryを通す", () => {
    const result = renderBackendResponse([{ shrine_id: 1, name: "火の神社", reason_facts: [fact("element", "火")] }]);

    expect(Array.isArray(result.recs[0].reason_facts)).toBe(true);
    expect(Array.isArray(result.unified.data.recommendations[0].reason_facts)).toBe(true);
    const recommendationSection = result.payload.sections.find((section) => section.type === "recommendations");
    expect(recommendationSection && Array.isArray(recommendationSection.items[0].reasonFacts)).toBe(true);
    expect(screen.getByTestId("recommendation-conclusion")).toHaveTextContent("火");
  });

  it("history_theme PrimaryをHeroと詳細meaning文言へ通す", () => {
    renderBackendResponse([{ shrine_id: 1, name: "再出発神社", reason_facts: [fact("history_theme", "再出発")] }]);
    expect(screen.getByTestId("recommendation-conclusion")).toHaveTextContent("再出発");
    expect(screen.getAllByText(/再出発/).length).toBeGreaterThan(0);
  });

  it("compact recommendationのPrimaryへBackend factを通す", () => {
    renderBackendResponse([
      { shrine_id: 1, name: "第一候補", reason_facts: [fact("need_tag", "仕事")] },
      { shrine_id: 2, name: "第二候補", reason_facts: [fact("visit_style", "自然")] },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "迷った時だけ、ほかの神社を見る" }));
    const compactCard = screen.getByText("第二候補").closest("article");
    expect(compactCard?.querySelector('[data-testid="recommendation-match-reason"]')).toHaveTextContent("自然");
  });

  it("malformed factとis_primaryなしを安全に無視しPrimaryを推測しない", () => {
    renderBackendResponse([{
      shrine_id: 1,
      name: "安全神社",
      reason_facts: [
        { type: "element", label: "不正", evidence: "invalid", score: 999, is_primary: true },
        fact("need_tag", "推測禁止", false),
      ],
    }]);
    expect(document.body).not.toHaveTextContent("不正");
    expect(document.body).not.toHaveTextContent("推測禁止");
  });
});
