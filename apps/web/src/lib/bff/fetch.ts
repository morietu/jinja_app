// apps/web/src/lib/bff/fetch.ts
import "server-only";

export type { BffFetchOptions } from "@/lib/server/bffFetch";
export { bffFetchWithAuthFromReq, bffPostJsonWithAuthFromReq } from "@/lib/server/bffFetch";
