import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { api, Shrine } from "../../lib/api";

export default function ShrineDetail(){
  const { id } = useLocalSearchParams<{id:string}>();
  const [detail, setDetail] = useState<Shrine | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(()=> {
    if (!id) return;
    const num = Number(id);
    let on = true;
    api.shrine(num)
      .then(d => on && setDetail(d))
      .catch(e => on && setErr(String(e)));
    return () => { on = false; }
  }, [id]);

  if (err) return <View style={{ padding: 16 }}><Text>エラー: {err}</Text></View>;
  if (!detail) return <View style={{ padding: 16 }}><ActivityIndicator /><Text> 読み込み中...</Text></View>;

  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{detail.name_jp ?? `#${detail.id}`}</Text>
      {detail.address ? <Text style={{ marginTop: 8 }}>{detail.address}</Text> : null}
      {detail.latitude != null && detail.longitude != null ? (
        <Text style={{ marginTop: 8, opacity: 0.7 }}>
          ({detail.latitude}, {detail.longitude})
        </Text>
      ) : null}
    </View>
  );
}
