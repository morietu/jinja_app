import type { ShrineSubmissionPayload, ShrineSubmissionResponse } from "@/features/shrine-submission/types";

export async function createShrineSubmission(payload: ShrineSubmissionPayload): Promise<ShrineSubmissionResponse> {
  const res = await fetch("/api/shrine-submissions/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : null;

  if (!res.ok) {
    const error = new Error("submission_failed") as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  return body as ShrineSubmissionResponse;
}
