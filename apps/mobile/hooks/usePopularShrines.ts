import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchPopular } from "../lib/shrines";
import type { ShrineSummary } from "../types/shrine";

export type PopularState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: ShrineSummary[]; nearby: boolean }
  | { status: "error"; message: string };

/**
** 位置許可が「許可」なら現在地10km圏の人気神社、
** 拒否/未許可なら全国人気を取得するフック。
 */
export function usePopularShrines(initialLimit = 10) {
  const [state, setState] = useState<PopularState>({ status: "idle" });

  const load = useCallback(async () => {
    setState({ status: "loading" });
    try {
      // 1) まず権限状態を確認（可能なら即リクエスト）
      const perm = await Location.getForegroundPermissionsAsync();
      let status = perm.status;
      if (status !== "granted" && status !== "denied") {
        // 未決ならリクエスト
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
      }

      if (status !== "granted") {
        // 2) 拒否/未許可 → 全国人気
        const data = await fetchPopular({ limit: initialLimit });
        setState({ status: "ready", data, nearby: false });
        return;
      }

      // 3) 許可 → 現在地取得（精度は Balanced）
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const near = {
        lat: current.coords.latitude,
        lng: current.coords.longitude,
      };
      const data = await fetchPopular({
        limit: initialLimit,
        near,
        radius_km: 10,
      });
      setState({ status: "ready", data, nearby: true });
    } catch (e: any) {
      setState({
        status: "error",
        message: e?.message ?? "人気情報の取得に失敗しました",
      });
    }
  }, [initialLimit]);

  useEffect(() => {
    load();
  }, [load]);

  return useMemo(() => ({ state, reload: load }), [state, load]);
}