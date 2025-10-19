// shrine-app/app/shrine/[id].tsx
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Linking, ActivityIndicator } from "react-native";
import { api, type Shrine } from "../../lib/api";

export default function ShrineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Shrine | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    setErr(null);
    setData(null);
    api.shrine(Number(id))
      .then(d => on && setData(d))
      .catch(e => on && setErr(e?.message ?? "fetch failed"));
    return () => { on = false; };
  }, [id]);

  const openMap = useCallback(() => {
    if (!data?.latitude || !data?.longitude) return;
    const lat = data.latitude;
    const lng = data.longitude;
    const label = encodeURIComponent(data.name_jp ?? `Shrine #${id}`);
    // iOS: Apple Maps / Android: Google Maps fallback / Web: google.com
    const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}(${label})`;
    Linking.openURL(url).catch(() => {});
  }, [data, id]);

  return (
    <View style={{ padding: 16 }}>
      <Stack.Screen options={{ title: data?.name_jp ?? `#${id}` }} />
      {err ? (
        <Text style={{ color: "red" }}>エラー: {err}</Text>
      ) : !data ? (
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <ActivityIndicator /><Text>読み込み中...</Text>
        </View>
      ) : (
        <>
          <Text style={{ fontSize: 20, fontWeight: "600" }}>{data.name_jp ?? `#${id}`}</Text>
          {data.address ? <Text style={{ marginTop: 8 }}>{data.address}</Text> : null}
          {!!data.latitude && !!data.longitude && (
            <TouchableOpacity onPress={openMap} style={{ marginTop: 12, padding: 12, borderWidth: 1, borderRadius: 8 }}>
              <Text>地図アプリで開く</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}
