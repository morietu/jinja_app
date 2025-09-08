import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import PopularShrineCard from "./PopularShrineCard";
import { CardSkeleton } from "./Skeletons";
import { usePopularShrines } from "../hooks/usePopularShrines";

export default function PopularSection() {
  const { state, reload } = usePopularShrines(10);
  const router = useRouter();

  const goDetail = (id: string) => router.push({ pathname: "/shrine/[id]", params: { id } });
  const goMap = () => router.push({ pathname: "/map", params: { filter: "popular", radius_km: "10" } });

  return (
    <View style={styles.box}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {state.status === "ready" && state.nearby ? "近場の人気" : "人気の神社"}
        </Text>
        <Pressable onPress={goMap}><Text style={styles.link}>地図で見る</Text></Pressable>
      </View>

      {state.status === "loading" && (
        <View style={{ gap: 10 }}>
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </View>
      )}

      {state.status === "error" && (
        <View style={styles.error}>
          <Text style={styles.errorText}>読み込みに失敗しました</Text>
          <Pressable onPress={reload}><Text style={styles.retry}>再試行</Text></Pressable>
        </View>
      )}

      {state.status === "ready" && (
        <View style={{ gap: 10 }}>
          {state.data.map((s) => (
            <PopularShrineCard key={s.id} item={s} onPress={goDetail} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#f8f8f8" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "700" },
  link: { color: "#2f6ee5", fontWeight: "600" },
  error: { backgroundColor: "#fff3f3", borderRadius: 12, padding: 12, alignItems: "center", gap: 8 },
  errorText: { color: "#b00020" },
  retry: { color: "#2f6ee5", fontWeight: "600" },
});