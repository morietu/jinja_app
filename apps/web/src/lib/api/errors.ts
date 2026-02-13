// apps/web/src/lib/api/errors.ts
import { ApiError } from "@/lib/api/ApiError";

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
