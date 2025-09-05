// apps/mobile/components/home/RankingCarousel.tsx
import * as React from "react";
import { Image, ScrollView, Text, View, StyleSheet, Pressable, Platform } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getFavorites, toggleFavorite } from "../../lib/storage";

type Shrine = {
  id: string;
  name: string;
  imageUrl: string;
  tags: string[];
  rating?: number;
  favorites?: number;
};

export default function RankingCarousel({ items }: { items: Shrine[] }) {
  const router = useRouter();

  // お気に入り集合（ハイライト判定用）
  const [favSet, setFavSet] = React.useState<Set<string>>(new Set());

  const refreshFavs = React.useCallback(async () => {
    const favs = await getFavorites();
    setFavSet(new Set(favs));
  }, []);

  // Home画面に戻ってきた時などに再読込
  useFocusEffect(
    React.useCallback(() => {
      refreshFavs();
    }, [refreshFavs])
  );

  const onToggleFav = async (id: string) => {
    await toggleFavorite(id);
    refreshFavs();
  };

  return (
    <View style={{ marginTop: 8, paddingHorizontal: 16 }}>
      {/* ヘッダー */}
      <View style={styles.headerRow}>
        <Text style={styles.title}>人気神社ランキング</Text>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={() => router.push("/ranking")} style={{ marginRight: 8 }}>
            <Text style={{ fontSize: 12, textDecorationLine: "underline" }}>もっと見る</Text>
          </Pressable>
          <View style={styles.badge}><Text style={styles.badgeText}>今週</Text></View>
        </View>
      </View>

      {/* 横スクロール */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 16 }}>
        {items.map((s, i) => {
          const favored = favSet.has(s.id);
          return (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/shrines/${s.id}`)}
              style={[
                styles.card,
                { marginRight: i === items.length - 1 ? 0 : 12 },
                favored && styles.cardFav
              ]}
            >
              {/* ハートの小ボタン（カード右上・タップでトグル／ナビは発火させない） */}
              <Pressable
                onPress={(e) => { e.stopPropagation(); onToggleFav(s.id); }}
                style={[styles.heartFab, favored && styles.heartFabFav]}
                hitSlop={8}
              >
                <Text style={[styles.heartFabText, favored && styles.heartFabTextFav]}>
                  {favored ? "♡" : "♡"}
                </Text>
              </Pressable>

              <Image source={{ uri: s.imageUrl }} style={styles.img} />
              <View style={{ padding: 12 }}>
                <Text numberOfLines={1} style={styles.name}>{s.name}</Text>
                <View style={styles.tagRow}>
                  {s.tags.slice(0, 3).map((t) => (
                    <View key={t} style={styles.tag}><Text style={styles.tagText}>{t}</Text></View>
                  ))}
                </View>
                <View style={styles.rowSpace}>
                  <Text style={styles.meta}>★ {(s.rating ?? 4.6).toFixed(1)}</Text>
                  <Text style={styles.meta}>♡ {s.favorites ?? 0}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const shadow = Platform.select({
  ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  android: { elevation: 3 },
  default: { boxShadow: "0 6px 16px rgba(0,0,0,0.08)" } as any,
});

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "600" },
  badge: { backgroundColor: "#F2C94C", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: "500", color: "#111" },

  card: {
    width: 256,
    borderRadius: 16,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#e6e6e6",
    overflow: "hidden",
    position: "relative",
    ...shadow,
  },
  cardFav: {
    borderColor: "#E24E33",
    backgroundColor: "rgba(226,78,51,0.06)",
  },
  img: { width: "100%", aspectRatio: 16 / 9, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  name: { fontWeight: "600" },
  tagRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  tag: { borderRadius: 999, backgroundColor: "#F4F4F5", paddingHorizontal: 8, paddingVertical: 2, marginRight: 6, marginBottom: 6 },
  tagText: { fontSize: 11 },
  rowSpace: { flexDirection: "row", justifyContent: "space-between" },
  meta: { color: "#666", fontSize: 12 },

  heartFab: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  heartFabFav: {
    borderColor: "#E24E33",
    backgroundColor: "#fff",
  },
  heartFabText: { fontSize: 14, color: "#111" },
  heartFabTextFav: { color: "#E24E33" },
});
