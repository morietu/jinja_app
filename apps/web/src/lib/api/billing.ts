export type BillingStatus = {
  plan: string;
  is_active: boolean;
  provider: string;
};

function apiBase(): string {
  // 例: http://127.0.0.1:8000 もしくは https://jinja-backend.onrender.com
  // 空なら同一オリジン（Nextの /api 経由など）にも対応できる
  return process.env.NEXT_PUBLIC_API_BASE ?? "";
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const base = apiBase();
  const url = `${base}/api/billings/status/`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`billing status ${res.status}`);

  const json = (await res.json()) as Partial<BillingStatus>;
  return {
    plan: json.plan ?? "free",
    is_active: Boolean(json.is_active),
    provider: json.provider ?? "unknown",
  };
}
