// apps/mobile/app/shrines/[id].tsx
import * as React from "react";
import {
  View, Text, Image, Pressable, StyleSheet, ScrollView,
  Linking, Platform
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SHRINES } from "../../data/shrines";
import { incVisits, isFavorite, toggleFavorite, pushRecent } from "../../lib/storage";

export default function ShrineDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const s = SHRINES.find((x) => x.id === id);
  const [fav, setFav] = React.useState(false);

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

  React.useEffect(() => {
    if (!id) return;
    isFavorite(String(id)).then(setFav).catch(() => {});
    pushRecent(String(id)).catch(() => {});
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

  const openMapSearch = React.useCallback(() => {
    const q = encodeURIComponent(s.name);
    const url = Platform.select({
      ios: `maps://?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    })!;
    Linking.openURL(url).catch(() => {});
  }, [s.name]);

  const openDirections = React.useCallback(() => {
    const q = encodeURIComponent(s.name);
    const url = Platform.select({
      ios: `maps://?daddr=${q}`,
      android: `google.navigation:q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    })!;
    Linking.openURL(url).catch(() => {});
  }, [s.name]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F6F3EE" }}>
      <Image source={{ uri: s.imageUrl }} style={{ width: "100%", aspectRatio: 16 / 10 }} />
      <View style={{ padding: 16 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "700" }}>{s.name}</Text>
            <Text style={{ color: "#555", marginTop: 6 }}>{s.prefecture}</Text>
          </View>
          <Pressable onPress={onToggleFav} style={styles.favBtn}>
            <Text style={{ fontSize: 16 }}>{fav ? "♡ 解除" : "♡ お気に入り"}</Text>
          </Pressable>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
          {s.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={{ fontSize: 12 }}>{t}</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Pressable onPress={openMapSearch} style={[styles.navBtn, { marginRight: 8 }]}>
            <Text style={{ fontWeight: "700" }}>地図で見る</Text>
          </Pressable>
          <Pressable onPress={openDirections} style={styles.navBtnPrimary}>
            <Text style={{ fontWeight: "700", color: "#111" }}>経路案内</Text>
          </Pressable>
        </View>

        <Text style={{ color: "#444", marginTop: 12, lineHeight: 20 }}>
          {s.description ?? "ご利益や混雑、アクセス、御朱印情報などをここに表示します。"}
        </Text>

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
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e6e6e6",
  },
  back: {
    alignSelf: "flex-start", borderWidth: 1, borderColor: "#ddd",
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#fff"
  },
  tag: {
    borderRadius: 999, backgroundColor: "#F4F4F5",
    paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8
  },
  navBtn: {
    height: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center",
    borderRadius: 10, borderWidth: 1, borderColor: "#e6e6e6", backgroundColor: "#F2F2F2"
  },
  navBtnPrimary: {
    height: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center",
    borderRadius: 10, borderWidth: 1, borderColor: "#e6e6e6", backgroundColor: "#F2C94C"
  },
});
