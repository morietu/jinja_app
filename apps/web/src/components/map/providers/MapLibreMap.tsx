"use client";
import { useEffect, useRef } from "react";
import maplibregl, { Map, LngLatBoundsLike } from "maplibre-gl";
import type { LatLng, Marker as MarkerType } from "../MapSwitcher";
import type { Feature, FeatureCollection, LineString } from "geojson";


type Props = {
  center: LatLng;
  zoom?: number;
  markers?: MarkerType[];
  origin?: LatLng | null;
  destination?: LatLng | null;
};

export default function MapLibreMap({
  center,
  zoom = 14,
  markers = [],
  origin = null,
  destination = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Map | null>(null);
  const routeSourceId = "route";
  const routeLayerId = "route-line";

  // 初期化
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [center.lng, center.lat],
      zoom,
    });
    mapRef.current = map;

    // ズーム/回転制御（適度に）
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-right"
    );

    map.on("load", () => {
      // 通常の markers
      markers.forEach((m) => {
        new maplibregl.Marker()
          .setLngLat([m.position.lng, m.position.lat])
          .setPopup(
            m.label
              ? new maplibregl.Popup({ offset: 12 }).setText(m.label)
              : undefined
          )
          .addTo(map);
      });

      // 初回のルート描画
      drawRoute();
      fitIfNeeded();
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line
  }, []); // 初期化は一度だけ

  // origin/destination 変化でライン更新
  useEffect(() => {
    drawRoute();
    fitIfNeeded();
    // eslint-disable-next-line
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  // center/zoom 変化で中心更新（任意）
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!map.loaded()) return;

    map.easeTo({ center: [center.lng, center.lat], zoom, duration: 300 });
  }, [center.lat, center.lng, zoom]);

  function drawRoute() {
    const map = mapRef.current;
    if (!map || !map.getStyle()) return;
    if (!map.loaded()) return;

    // 既存のピンを一旦消すわけではなく、origin/destination は専用色で追加
    // マーカーは「load」後に毎回追加だと重複するので、シンプルに一度レイヤー/ソースだけ更新する方式にする
    // → origin/destination は Marker（DOM）で扱うと管理が面倒なので、ここではラインのみ更新し、
    //   ピンは簡易に Marker で入れる（古いピンの掃除は最小限）

    // まず既存の route レイヤー/ソースを用意またはクリア
    const routeGeoJSON: FeatureCollection<LineString> =
      origin && destination
        ? {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: [
                    [origin.lng, origin.lat],
                    [destination.lng, destination.lat],
                  ],
                },
              } satisfies Feature<LineString>,
            ],
          }
        : {
            type: "FeatureCollection",
            features: [],
          };

    // 追加時
    map.addSource(routeSourceId, {
      type: "geojson",
      data: routeGeoJSON, // ← 型OK
    });

    // 更新時
    const source = map.getSource(routeSourceId) as
      | maplibregl.GeoJSONSource
      | undefined;

    if (!source) {
      map.addSource(routeSourceId, { type: "geojson", data: routeGeoJSON });
      if (!map.getLayer(routeLayerId)) {
        map.addLayer({
          id: routeLayerId,
          type: "line",
          source: routeSourceId,
          paint: {
            "line-color": "#0ea5e9",
            "line-width": 4,
            "line-opacity": 0.9,
          },
        });
      }
    } else {
      source.setData(routeGeoJSON);
    }

    // origin/destination のマーカーは都度作り直す（簡易実装）
    // 既存の Markers を覚えておいて…という管理は省略し、レイヤーに任せるなら
    // シンボルレイヤーでピンを描く方法もあるが、まずは Marker で最短に。
    // ここでは id をキーに data 属性を見て既存を消す簡易実装。
    cleanupDynamicMarkers();
    if (origin) addDynamicMarker([origin.lng, origin.lat], "#1d4ed8", "origin");
    if (destination)
      addDynamicMarker(
        [destination.lng, destination.lat],
        "#ef4444",
        "destination"
      );
  }

  function addDynamicMarker(
    [lng, lat]: [number, number],
    color: string,
    dataId: string
  ) {
    const map = mapRef.current!;
    const el = document.createElement("div");
    el.style.width = "12px";
    el.style.height = "12px";
    el.style.borderRadius = "9999px";
    el.style.background = color;
    el.dataset.dynamicMarkerId = dataId;

    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
  }

  function cleanupDynamicMarkers() {
    // 直近で追加した動的マーカーを全て削除
    const container = containerRef.current;
    if (!container) return;
    const markers = container.querySelectorAll("[data-dynamic-marker-id]");
    markers.forEach((el) => el.parentElement?.parentElement?.remove()); // marker -> container -> map canvas sibling
  }

  function fitIfNeeded() {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    if (!(origin && destination)) return;

    const bounds: LngLatBoundsLike = [
      [origin.lng, origin.lat],
      [destination.lng, destination.lat],
    ];
    map.fitBounds(bounds, { padding: 40, maxZoom: 15, duration: 300 });
  }

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
