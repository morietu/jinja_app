import { View, StyleSheet } from "react-native";

export function CardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={[styles.shimmer, { width: "60%", height: 14 }]} />
      <View style={[styles.shimmer, { width: "85%", height: 12, marginTop: 8 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 12, gap: 6, elevation: 2 },
  shimmer: { backgroundColor: "#eee", borderRadius: 8 },
});