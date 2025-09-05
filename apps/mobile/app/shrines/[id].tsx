// apps/mobile/app/shrines/[id].tsx
import * as React from "react";
import { View, Text, Image, Pressable, StyleSheet, ScrollView } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SHRINES } from "../../data/shrines";
import { incVisits, isFavorite, toggleFavorite } from "../../lib/storage";

export default function ShrineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = SHRINES.find((x) => x.id === id);
  const [fav, setFav] = React.useState(false);

  // 1回だけ参拝+1
  const countedRef = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      if (!countedRef.current) {
        countedRef.current = true;
        incVisits(1).catch(() => {});
      }
      return () => {};
    }, [id])
  );

  // お気に入り初期読み込み
  React.useEffect(() => {
    if (!id) return;
    isFavorite(String(id)).then(setFav).catch(() => {});
  }, [id]);

  const onToggleFav = async () => {
    if (!id) return;
    const now = await toggleFavorite(String(id));
    setFav(now);
  };

  if (!s) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F6F3EE" }}>
        <Text>該当の神社が見つかりませんでした。</Text>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text>← 戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F6F3EE" }}>
      <Image source={{ uri: s.imageUrl }} style={{ width: "100%", aspectRatio: 16 / 10 }} />
      <View style={{ padding: 16 }}>
        {/* タイトル行 + ♡（同じ行に収める） */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "700" }}>{s.name}</Text>
            <Text style={{ color: "#555", marginTop: 6 }}>{s.prefecture}</Text>
          </View>
          <Pressable onPress={onToggleFav} style={styles.favBtn}>
            <Text style={{ fontSize: 16 }}>{fav ? "♡ 解除" : "♡ お気に入り"}</Text>
          </Pressable>
        </View>

        {/* タグ */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {s.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={{ fontSize: 12 }}>{t}</Text>
            </View>
          ))}
        </View>

        {/* 説明 */}
        <Text style={{ color: "#444", marginTop: 12, lineHeight: 20 }}>
          {s.description ?? "ご利益や混雑、アクセス、御朱印情報などをここに表示します。"}
        </Text>

        {/* 戻る */}
        <Pressable onPress={() => router.back()} style={[styles.back, { marginTop: 16 }]}>
          <Text style={{ fontWeight: "600" }}>← ランキングに戻る</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  favBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },

  back: { alignSelf: "flex-start", borderWidth: 1, borderColor: "#ddd", paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#fff" },
  tag: { borderRadius: 999, backgroundColor: "#F4F4F5", paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 },
});
