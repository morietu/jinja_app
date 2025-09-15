import { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { api, Shrine } from "../../lib/api";

export default function PopularList() {
  const [data, setData] = useState<Shrine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let on = true;
    api.popular(20)
      .then(d => on && setData(d))
      .catch(e => on && setErr(String(e)));
    return () => { on = false; };
  }, []);

  if (err) return <View style={{ padding: 16 }}><Text>エラー: {err}</Text></View>;
  if (!data) return <View style={{ padding: 16 }}><ActivityIndicator /><Text> 読み込み中...</Text></View>;

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 12 }}
      renderItem={({ item }) => (
        <Link href={`/shrine/${item.id}`} asChild>
          <TouchableOpacity style={{ padding: 12, borderRadius: 8, borderWidth: 1, marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.name_jp || `#${item.id}`}</Text>
            {item.address ? <Text style={{ marginTop: 4, opacity: 0.7 }}>{item.address}</Text> : null}
          </TouchableOpacity>
        </Link>
      )}
    />
  );
}
