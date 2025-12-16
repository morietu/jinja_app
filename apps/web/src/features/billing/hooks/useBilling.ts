"use client";

import { useEffect, useState } from "react";
import { getBillingStatus, type BillingStatus } from "@/lib/api/billing";

type UseBillingState =
  | { loading: true; status: null; error: null; refresh: () => Promise<void> }
  | { loading: false; status: BillingStatus; error: null; refresh: () => Promise<void> }
  | { loading: false; status: null; error: string; refresh: () => Promise<void> };


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
        setStatus(null);
        setError(e instanceof Error ? e.message : "unknown error");
      } finally {
        setLoading(false);
      }
    };

    useEffect(() => {
      refresh();
    }, []);

    if (loading) {
      return { loading: true, status: null, error: null, refresh };
    }
    if (error) {
      return { loading: false, status: null, error, refresh };
    }
    return { loading: false, status: status!, error: null, refresh };
  }
