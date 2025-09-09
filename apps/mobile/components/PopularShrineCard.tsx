// apps/mobile/components/PopularShrineCard.tsx
import React from "react";
import { Pressable, View, Text, StyleSheet, Image } from "react-native";
import { Link } from "expo-router";
import { MaterialIcons } from "@expo/vector-icons";

type Props = {
  id: number | string;
  name: string;
  address?: string;
  rating?: number;
  photo_url?: string;
  popularity?: number; // バッジ表示に使用（任意）
  onPress?: () => void; // 外から押下処理を差し込みたいとき用（通常は未使用）
};

export default function PopularShrineCard({
  id, name, address, rating, photo_url, popularity, onPress,
}: Props) {
  const href = `/shrines/${id}`;

  const CardBody = (
    <View style={styles.cardInner}>
      <Image
        source={photo_url ? { uri: photo_url } : require("../assets/placeholder.png")}
        style={styles.image}
      />
      <View style={styles.content}>
        <View style={styles.row}>
          <Text numberOfLines={1} style={styles.name}>{name}</Text>
          {typeof popularity === "number" && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{Math.round(popularity)}</Text>
            </View>
          )}
        </View>
        {address ? <Text numberOfLines={1} style={styles.addr}>{address}</Text> : null}
        <View style={styles.ratingRow}>
          <MaterialIcons name="star" size={14} />
          <Text style={styles.ratingText}>{rating ?? "—"}</Text>
        </View>
      </View>
    </View>
  );

  const PressableCard = (
    <Pressable
      android_ripple={{ radius: 280 }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      onPress={onPress}
    >
      {CardBody}
    </Pressable>
  );

  // onPress が渡されていない場合は Link で宣言的遷移
  if (!onPress) {
    return (
      <Link href={href} asChild>
        {PressableCard}
      </Link>
    );
  }
  return PressableCard;
}

const styles = StyleSheet.create({
  card: {
    width: 240,
    marginRight: 12,
    borderRadius: 14,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    overflow: "hidden",
  },
  pressed: { opacity: 0.9 },
  cardInner: { backgroundColor: "#fff" },
  image: { width: "100%", aspectRatio: 16 / 9, resizeMode: "cover" },
  content: { padding: 10, gap: 4 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { fontSize: 16, fontWeight: "700", flexShrink: 1, marginRight: 8 },
  addr: { fontSize: 13, color: "#666" },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { color: "#444", fontWeight: "600" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#EFEFEF" },
  badgeText: { fontSize: 12, fontWeight: "700" },
});
