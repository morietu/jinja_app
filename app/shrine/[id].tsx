// app/shrine/[id].tsx
import { useLocalSearchParams, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { api, type Shrine } from "../../lib/api";

export default function ShrineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<Shrine | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    if (id) {
      api
        .shrine(Number(id))
        .then((d) => on && setData(d))
        .catch((e) => on && setErr(String(e)));
    }
    return () => {
      on = false;
    };
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ title: data?.name_jp ?? `#${id}` }} />
      {err ? (
        <View style={{ padding: 16 }}>
          <Text style={{ color: "red" }}>エラー: {err}</Text>
        </View>
      ) : !data ? (
        <View style={{ padding: 16 }}>
          <ActivityIndicator />
          <Text> 読み込み中...</Text>
        </View>
      ) : (
        <View style={{ padding: 16 }}>
          <Text style={{ fontSize: 20, fontWeight: "600" }}>
            {data.name_jp ?? `#${data.id}`}
          </Text>
          {data.address ? (
            <Text style={{ marginTop: 8 }}>{data.address}</Text>
          ) : null}
        </View>
      )}
    </>
  );
}
