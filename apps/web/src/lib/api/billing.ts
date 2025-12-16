export type BillingStatus = {
  plan: "free" | "premium";
  is_active: boolean;
  provider: "stub" | "stripe" | "revenuecat" | "unknown";
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
};

function apiBase(): string {
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const base = apiBase();
  const url = `${base}/api/billings/status/`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`billing status ${res.status}`);

  const json = (await res.json()) as BillingStatus;
  return json;
}
