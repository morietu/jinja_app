import { useState } from "react";
import { fetchConciergePlan, type ConciergePlanRequest, type ConciergePlanResponse } from "@/api/conciergePlan";

export function useConciergePlan() {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<ConciergePlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createPlan(body: ConciergePlanRequest) {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchConciergePlan(body);
      setPlan(result);
    } catch (e: any) {
      setError(e?.message ?? "Plan API error");
    } finally {
      setLoading(false);
    }
  }

  return { plan, loading, error, createPlan };
}
