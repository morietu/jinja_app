import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import PopularShrineCard from "./PopularShrineCard";
import { CardSkeleton } from "./Skeletons";
import { usePopularShrines } from "../hooks/usePopularShrines";

export default function PopularSection() {
  const { state, reload } = usePopularShrines(10);

  const goMap = () =>
    // map 画面がある前提のまま残しています。未実装ならここは後続PRで対応。
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    router.push({ pathname: "/map", params: { filter: "popular", radius_km: "10" } });

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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingRight: 16, gap: 12 }}
        >
          {state.data.map((s) => (
            <PopularShrineCard
              key={String(s.id)}
              id={s.id}
              name={s.name}
              address={s.address}
              rating={s.rating}
              photo_url={s.photo_url}
              popularity={s.popularity}
              // PopularShrineCard 側が Link で遷移する実装なので onPress は不要
              // onPress を使いたい場合は以下のように：
              // onPress={() => router.push({ pathname: "/shrines/[id]", params: { id: String(s.id) } })}
            />
          ))}
        </ScrollView>
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
