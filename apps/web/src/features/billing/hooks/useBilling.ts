"use client";

import { useEffect, useState } from "react";
import { getBillingStatus, type BillingStatus } from "@/lib/api/billing";

type UseBillingState = {
  status: BillingStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

export function useBilling(): UseBillingState {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      const s = await getBillingStatus();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { status, loading, error, refresh };
}
