export type BillingStatus = {
  plan: "free" | "premium";
  is_active: boolean;
  provider: "stub" | "stripe" | "revenuecat" | "unknown";
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
};

export type BillingCheckoutSession = {
  session_id: string;
  checkout_url: string;
};

export type BillingPortalSession = {
  portal_url: string;
};



export async function getBillingStatus(): Promise<BillingStatus> {
  const res = await fetch("/api/billings/status/", {
    cache: "no-store",
    credentials: "include",
  });
  if (!res.ok) throw new Error(`billing status ${res.status}`);
  return (await res.json()) as BillingStatus;
}

export async function startBillingCheckout(): Promise<BillingCheckoutSession> {
  const res = await fetch("/api/billings/checkout", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`billing checkout ${res.status}`);

  const data = (await res.json()) as BillingCheckoutSession;
  if (!data.checkout_url) throw new Error("checkout url missing");
  return data;
}

export async function startBillingPortal(): Promise<BillingPortalSession> {
  const res = await fetch("/api/billings/portal", {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  if (!res.ok) throw new Error(`billing portal ${res.status}`);

  const data = (await res.json()) as BillingPortalSession;
  if (!data.portal_url) throw new Error("portal url missing");
  return data;
}
