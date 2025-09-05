// apps/mobile/app/ranking/index.tsx
import * as React from "react";
import { ScrollView, View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SHRINES } from "../../data/shrines";
import { getFavorites, toggleFavorite } from "../../lib/storage";

export default function RankingPage() {
  const router = useRouter();

  // お気に入り数の多い順で表示
  const items = React.useMemo(
    () => [...SHRINES].sort((a, b) => (b.favorites ?? 0) - (a.favorites ?? 0)),
    []
  );

  // お気に入り集合（ハイライト判定用）
  const [favSet, setFavSet] = React.useState<Set<string>>(new Set());
  const [favOnly, setFavOnly] = React.useState(false); // ← 追加

  const refreshFavs = React.useCallback(async () => {
    const favs = await getFavorites();
    setFavSet(new Set(favs));
  }, []);

  useFocusEffect(React.useCallback(() => { refreshFavs(); }, [refreshFavs]));

  const onToggleFav = async (id: string) => {
    await toggleFavorite(id);
    refreshFavs();
  };

  const list = React.useMemo(
    () => items.filter(s => !favOnly || favSet.has(s.id)), // ← 絞り込み
    [items, favOnly, favSet]
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F6F3EE" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>人気神社ランキング</Text>
      <Text style={{ color: "#666", marginTop: 4, marginBottom: 12 }}>♡ お気に入り数の多い順</Text>

      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <Pressable
          onPress={() => setFavOnly(v => !v)}
          style={{
            paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
            borderWidth: 1, borderColor: "#e6e6e6", backgroundColor: favOnly ? "#F2C94C" : "#fff"
          }}
        >
          <Text style={{ fontSize: 12 }}>{favOnly ? "お気に入りのみ表示中" : "お気に入りだけ"}</Text>
        </Pressable>
        <Text style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>♡ {favSet.size}</Text>
      </View>

      {list.map((s, idx) => {
        const favored = favSet.has(s.id);
        return (
          <Pressable
            key={s.id}
            onPress={() => router.push(`/shrines/${s.id}`)}
            style={[styles.card, favored && styles.cardFav]}
          >
            <Text style={styles.rank}>{idx + 1}</Text>
            <Image source={{ uri: s.imageUrl }} style={styles.thumb} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{s.name}</Text>
              <Text style={styles.sub}>{s.prefecture}</Text>
              <Text style={styles.meta}>★ {(s.rating ?? 4.6).toFixed(1)}　♡ {s.favorites ?? 0}</Text>
            </View>

            <Pressable onPress={() => onToggleFav(s.id)} style={[styles.heartBtn, favored && styles.heartBtnFav]} hitSlop={8}>
              <Text style={[styles.heartText, favored && styles.heartTextFav]}>♡</Text>
            </Pressable>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e6e6e6",
    borderRadius: 12, padding: 10, marginBottom: 10,
  },
  cardFav: { borderColor: "#E24E33", backgroundColor: "rgba(226,78,51,0.06)" },
  rank: { width: 24, textAlign: "center", fontWeight: "700", marginRight: 8 },
  thumb: { width: 64, height: 48, borderRadius: 8, marginRight: 12 },
  name: { fontWeight: "600" },
  sub: { color: "#666", fontSize: 12, marginTop: 2 },
  meta: { color: "#666", fontSize: 12, marginTop: 4 },
  heartBtn: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: "#e6e6e6", backgroundColor: "#fff" },
  heartBtnFav: { borderColor: "#E24E33" },
  heartText: { fontSize: 16, color: "#111" },
  heartTextFav: { color: "#E24E33" },
});
