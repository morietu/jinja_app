import * as React from "react";
import { getNearbyShrines, NearbyShrine } from "@/lib/api/places";

type State =
  | { kind: "idle" | "loading" }
  | { kind: "success"; items: NearbyShrine[] }
  | { kind: "empty" }
  | { kind: "error"; message: string };

export function useNearbyShrines(lat: number, lng: number, limit = 20) {
  const [state, setState] = React.useState<State>({ kind: "idle" });
  const lastArgs = React.useRef({ lat, lng, limit });

  const fetchOnce = React.useCallback(async () => {
    setState({ kind: "loading" });
    lastArgs.current = { lat, lng, limit };
    try {
      const { data } = await getNearbyShrines({ lat, lng, limit });
      if (!data?.length) return setState({ kind: "empty" });
      setState({ kind: "success", items: data });
    } catch (e: any) {
      setState({ kind: "error", message: e?.message ?? "unknown error" });
    }
  }, [lat, lng, limit]);

  // 依存を正しく列挙（ESLint警告解消）
  React.useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  const refetch = React.useCallback(() => fetchOnce(), [fetchOnce]);
  const retry = React.useCallback(() => {
    const a = lastArgs.current;
    return getNearbyShrines(a)
      .then(({ data }) => {
        if (!data?.length) setState({ kind: "empty" });
        else setState({ kind: "success", items: data });
      })
      .catch((e: any) =>
        setState({ kind: "error", message: e?.message ?? "unknown error" })
      );
  }, []);

  return { state, refetch, retry };
}
