"use client";

import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";

type MapProps = {
  lat: number;
  lon: number;        // backend の longitude
  zoom?: number;
  height?: number | string; // 360 | "360px" どちらでもOK
};

// ---- Loader をシングルトン化して二重ロードを防止 ----
const getLoader = (() => {
  let loader: Loader | null = null;
  return () => {
    if (!loader) {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
      if (!apiKey) {
        // env 未設定時はここで早期 return し、呼び出し側の useEffect 内で警告
        return null;
      }
      loader = new Loader({
        apiKey,
        version: "weekly", // 最新安定
        // libraries は importLibrary を使うのでここでは指定しない
      });
    }
    return loader;
  };
})();

export default function Map({
  lat,
  lon,
  zoom = 16,
  height = 360,
}: MapProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されていません");
      return;
    }
    if (!divRef.current) return;

    const loader = getLoader();
    if (!loader) return;

    let cancelled = false;
    let map: google.maps.Map | null = null;
    let marker: google.maps.Marker | null = null;

    (async () => {
      // 推奨の importLibrary API を使用
      const { Map } = (await loader.importLibrary("maps")) as google.maps.MapsLibrary;

      if (cancelled || !divRef.current) return;

      const center = { lat, lng: lon };
      map = new Map(divRef.current, {
        center,
        zoom,
        mapId: process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID, // 任意のスタイルID
        gestureHandling: "greedy",
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
      });

      marker = new google.maps.Marker({
        position: center,
        map,
        title: "Shrine",
      });
    })();

    return () => {
      cancelled = true;
      if (marker) {
        marker.setMap(null);
        marker = null;
      }
      if (map) {
        google.maps.event.clearInstanceListeners(map);
        map = null; // 参照解放
      }
    };
  }, [lat, lon, zoom]);

  const h = typeof height === "number" ? `${height}px` : height;
  return <div ref={divRef} style={{ width: "100%", height: h }} />;
}
