import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";
import { NextRequest } from "next/server";

import { POST } from "../route";

vi.mock("server-only", () => ({}));

const DJANGO_ORIGIN = "http://127.0.0.1:8000";
const UPSTREAM_PORTAL = `${DJANGO_ORIGIN}/api/billings/portal/`;

const server = setupServer();

beforeAll(() => {
  process.env.DJANGO_ORIGIN = DJANGO_ORIGIN;
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  delete process.env.DJANGO_ORIGIN;
  server.close();
});

function makeReq() {
  return new NextRequest("http://localhost:3000/api/billings/portal", {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
}

describe("/api/billings/portal BFF", () => {
  it("backendへreturn_urlを渡してportal_urlだけを返す", async () => {
    server.use(
      http.post(UPSTREAM_PORTAL, async ({ request }) => {
        const body = (await request.json()) as Record<string, string>;
        expect(body).toEqual({ return_url: "http://localhost:3000/billing/manage" });
        return HttpResponse.json({
          portal_url: "https://billing.stripe.com/p/session/bps_123",
        });
      }),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      portal_url: "https://billing.stripe.com/p/session/bps_123",
    });
  });

  it("backendが401なら401を返す", async () => {
    server.use(
      http.post(UPSTREAM_PORTAL, async () =>
        HttpResponse.json({ detail: "Authentication credentials were not provided." }, { status: 401 }),
      ),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
  });

  it("backendが409ならcustomer未連携として409を返す", async () => {
    server.use(
      http.post(UPSTREAM_PORTAL, async () =>
        HttpResponse.json({ detail: "billing customer is not linked to this account" }, { status: 409 }),
      ),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "billing_customer_missing" });
  });

  it("backendが503なら503を返す", async () => {
    server.use(
      http.post(UPSTREAM_PORTAL, async () =>
        HttpResponse.json({ detail: "billing portal is unavailable" }, { status: 503 }),
      ),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "billing_portal_unavailable" });
  });

  it("backendの生エラー本文をユーザーへ露出しない", async () => {
    server.use(
      http.post(UPSTREAM_PORTAL, async () =>
        HttpResponse.json(
          { detail: "StripeError: No such customer: cus_leaked (sk_live_secret)" },
          { status: 500 },
        ),
      ),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(503);
    const text = await res.text();
    expect(text).not.toContain("cus_leaked");
    expect(text).not.toContain("sk_live_secret");
    expect(text).not.toContain("StripeError");
    expect(JSON.parse(text)).toEqual({ error: "billing_portal_unavailable" });
  });

  it("backendが200でもportal_urlが欠けていれば503にする", async () => {
    server.use(
      http.post(UPSTREAM_PORTAL, async () => HttpResponse.json({ portal_url: "" })),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "billing_portal_unavailable" });
  });
});
