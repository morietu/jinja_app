
import { Pressable, View, Text, StyleSheet } from "react-native";
import type { ShrineSummary } from "../types/shrine";

type Props = { item: ShrineSummary; onPress: (id: string) => void };

export default function PopularShrineCard({ item, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={() => onPress(item.id)}>
      <View style={styles.headerRow}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{Math.round(item.popularity)}</Text>
        </View>
      </View>
      <Text style={styles.addr} numberOfLines={1}>{item.address}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 6, elevation: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { fontSize: 16, fontWeight: "600", flexShrink: 1, marginRight: 8 },
  addr: { fontSize: 13, color: "#444" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: "#EFEFEF" },
  badgeText: { fontSize: 12, fontWeight: "700" },
});