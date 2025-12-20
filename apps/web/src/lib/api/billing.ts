export type BillingStatus = {
  plan: "free" | "premium";
  is_active: boolean;
  provider: "stub" | "stripe" | "revenuecat" | "unknown";
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
};



export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await fetch("/api/billings/status/", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`billing status ${res.status}`);
  return (await res.json()) as BillingStatus;
}
