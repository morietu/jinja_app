// apps/mobile/app/shrines/[id].tsx
import * as React from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SHRINES } from "../../data/shrines";
import {
  incVisits,
  isFavorite,
  toggleFavorite,
  pushRecent,
} from "../../lib/storage";

type LatLng = { lat: number; lng: number };
type Shrine = {
  id: string | number;
  name: string;
  prefecture?: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  latitude?: number;
  longitude?: number;
};

export default function ShrineDetail() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const shrineId = React.useMemo(() => {
    const raw = params.id;
    if (!raw) return undefined;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params.id]);

  const router = useRouter();
  const shrine: Shrine | undefined = React.useMemo(
    () => SHRINES.find((x: Shrine) => String(x.id) === String(shrineId)),
    [shrineId]
  );

  const [fav, setFav] = React.useState(false);

  const tags = shrine.tags ?? [];

  // 参拝カウント（初回フォーカス時のみ）
  const countedRef = React.useRef(false);
  useFocusEffect(
    React.useCallback(() => {
      if (!countedRef.current) {
        countedRef.current = true;
        // NOTE: もし incVisits が「対象IDのカウント」関数なら incVisits(String(shrineId)) に変更
        incVisits(1).catch(() => {});
      }
      return () => {};
    }, [shrineId])
  );

  // お気に入り状態・最近見た保存
  React.useEffect(() => {
    if (!shrineId) return;
    isFavorite(String(shrineId))
      .then(setFav)
      .catch(() => {});
    pushRecent(String(shrineId)).catch(() => {});
  }, [shrineId]);

  const onToggleFav = async () => {
    if (!shrineId) return;
    const now = await toggleFavorite(String(shrineId));
    setFav(now);
  };

  const openMapSearch = React.useCallback(() => {
    if (!shrine) return;
    // 座標が取れるなら座標を優先
    if (
      typeof shrine.latitude === "number" &&
      typeof shrine.longitude === "number"
    ) {
      const ll = `${shrine.latitude},${shrine.longitude}`;
      const url = Platform.select({
        ios: `maps://?q=${encodeURIComponent(shrine.name)}&ll=${ll}`,
        android: `geo:${ll}?q=${encodeURIComponent(shrine.name)}`,
        default: `https://www.google.com/maps/search/?api=1&query=${ll}`,
      })!;
      Linking.openURL(url).catch(() => {});
      return;
    }
    // 名前検索にフォールバック
    const q = encodeURIComponent(shrine.name);
    const url = Platform.select({
      ios: `maps://?q=${q}`,
      android: `geo:0,0?q=${q}`,
      default: `https://www.google.com/maps/search/?api=1&query=${q}`,
    })!;
    Linking.openURL(url).catch(() => {});
  }, [shrine]);

  const openDirections = React.useCallback(() => {
    if (!shrine) return;
    // 座標が取れるなら座標を優先
    if (
      typeof shrine.latitude === "number" &&
      typeof shrine.longitude === "number"
    ) {
      const ll = `${shrine.latitude},${shrine.longitude}`;
      const url = Platform.select({
        ios: `maps://?daddr=${ll}`,
        android: `google.navigation:q=${ll}`,
        default: `https://www.google.com/maps/dir/?api=1&destination=${ll}`,
      })!;
      Linking.openURL(url).catch(() => {});
      return;
    }
    // 名前指定にフォールバック
    const q = encodeURIComponent(shrine.name);
    const url = Platform.select({
      ios: `maps://?daddr=${q}`,
      android: `google.navigation:q=${q}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${q}`,
    })!;
    Linking.openURL(url).catch(() => {});
  }, [shrine]);

  if (!shrineId) {
    return (
      <View style={styles.center}>
        <Text>パラメータ `id` が不正です。</Text>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text>← 戻る</Text>
        </Pressable>
      </View>
    );
  }

  if (!shrine) {
    return (
      <View style={styles.center}>
        <Text>該当の神社が見つかりませんでした。</Text>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text>← 戻る</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#F6F3EE" }}>
      {shrine.imageUrl ? (
        <Image source={{ uri: shrine.imageUrl }} style={{ width: "100%", aspectRatio: 16 / 10 }} />
      ) : (
        <View
          style={{
            width: "100%",
            aspectRatio: 16 / 10,
            backgroundColor: "#eaeaea",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ color: "#777" }}>No Image</Text>
        </View>
      )}

      <View style={{ padding: 16 }}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontSize: 22, fontWeight: "700" }}>{shrine.name}</Text>
            {!!shrine.prefecture && <Text style={{ color: "#555", marginTop: 6 }}>{shrine.prefecture}</Text>}
          </View>
          <Pressable
            onPress={onToggleFav}
            style={styles.favBtn}
            accessibilityRole="button"
            accessibilityLabel="お気に入りの切り替え"
          >
            <Text style={{ fontSize: 16 }}>{fav ? "♡ 解除" : "♡ お気に入り"}</Text>
          </Pressable>
        </View>

        {!!shrine.tags?.length && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
            {tags.map((t) => (
              <React.Fragment key={t}>
                <View style={styles.tag}>...</View>
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={{ flexDirection: "row", marginTop: 12 }}>
          <Pressable onPress={openMapSearch} style={[styles.navBtn, { marginRight: 8 }]}>
            <Text style={{ fontWeight: "700" }}>地図で見る</Text>
          </Pressable>
          <Pressable onPress={openDirections} style={styles.navBtnPrimary}>
            <Text style={{ fontWeight: "700", color: "#111" }}>経路案内</Text>
          </Pressable>
        </View>

        <Text style={{ color: "#444", marginTop: 12, lineHeight: 20 }}>
          {shrine.description ?? "ご利益や混雑、アクセス、御朱印情報などをここに表示します。"}
        </Text>

        <Pressable onPress={() => router.back()} style={[styles.back, { marginTop: 16 }]}>
          <Text style={{ fontWeight: "600" }}>← ランキングに戻る</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F3EE",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  favBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  back: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
  },
  tag: {
    borderRadius: 999,
    backgroundColor: "#F4F4F5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 8,
    marginBottom: 8,
  },
  navBtn: {
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#F2F2F2",
  },
  navBtnPrimary: {
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#F2C94C",
  },
});
