// shrine-app/app/(tabs)/index.tsx
import { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { api, type Shrine } from "../../lib/api";

export default function PopularList() {
  const [data, setData] = useState<Shrine[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const d = await api.popular(20);
      setData(d);
    } catch (e: any) {
      setErr(e?.message ?? "fetch failed");
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  if (err) {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: "red", marginBottom: 8 }}>エラー: {err}</Text>
        <TouchableOpacity onPress={load} style={{ padding: 12, borderWidth: 1, borderRadius: 8 }}>
          <Text>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <ActivityIndicator />
        <Text>読み込み中...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={{ padding: 12 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
