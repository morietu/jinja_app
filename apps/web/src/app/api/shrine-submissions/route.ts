import { NextRequest } from "next/server";
import { bffFetchWithAuthFromReq } from "@/lib/server/bffFetch";

export async function POST(req: NextRequest) {
  const body = await req.text();

  return bffFetchWithAuthFromReq(req, "/api/shrine-submissions/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body,
  });
}
