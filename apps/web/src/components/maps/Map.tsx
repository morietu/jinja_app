import { Loader } from "@googlemaps/js-api-loader";
import { useEffect, useRef } from "react";

type MapProps = {
  lat: number;
  lon: number; // backend の longitude
  zoom?: number;
  height?: string;
};

export default function Map({ lat, lon, zoom = 16, height = "360px" }: MapProps) {
  const divRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;
    const mapId = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID; // 任意
    if (!apiKey) {
      // 開発時の見落としを防ぐ
      console.warn("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が設定されていません");
      return;
    }

    const loader = new Loader({
      apiKey,
      version: "weekly",
      libraries: [], // 追加ライブラリ不要なら空
    });

    let map: google.maps.Map | null = null;
    let marker: google.maps.Marker | null = null;

    loader.load().then(() => {
      if (!divRef.current) return;
      const center = { lat, lng: lon };
      map = new google.maps.Map(divRef.current, {
        center,
        zoom,
        mapId, // スタイル適用（設定されていれば）
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
    });

    return () => {
      // 明示破棄（GC任せでもOKだが念のため）
      marker?.setMap(null);
      // @ts-expect-error destroy がないので参照解放のみ
      map = null;
    };
  }, [lat, lon, zoom]);

  return <div ref={divRef} style={{ width: "100%", height }} />;
}
