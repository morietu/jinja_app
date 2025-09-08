// components/home/RecentViewed.tsx
import * as React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { SHRINES } from "../../data/shrines";

const KEY = "recent_shrines"; // string[] の ID を保存

export default function RecentViewed() {
  const router = useRouter();
  const [items, setItems] = React.useState<any[]>([]);
  React.useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const ids: string[] = raw ? JSON.parse(raw) : [];
        // 直近5件のみ、ID順で SHRINES から引く
        const map = new Map(SHRINES.map(s => [String(s.id), s]));
        const picked = ids.map(id => map.get(String(id))).filter(Boolean).slice(0, 5) as any[];
        setItems(picked);
      } catch {}
    })();
  }, []);

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>最近見た神社</Text>
      {items.length === 0 ? (
        <Text style={{ color: "#777" }}>最近見た神社はまだありません。</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/shrines/${s.id}`)}
              style={{ width: 200, marginRight: 12, padding: 12, borderRadius: 12, backgroundColor: "white", borderWidth: 1, borderColor: "#eee" }}
            >
              <Text style={{ fontWeight: "700" }} numberOfLines={1}>{s.name}</Text>
              <Text style={{ color: "#777" }} numberOfLines={1}>{s.address}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
