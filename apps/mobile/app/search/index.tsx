import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";
import { SHRINES } from "../../data/shrines";

export default function SearchPage() {
  const router = useRouter();
  const { q, filters } = useLocalSearchParams<{ q?: string; filters?: string }>();
  const query = (q ?? "").toLowerCase();
  const selected = (filters ?? "").split(",").filter(Boolean);

  const filtered = SHRINES.filter(s => {
    const textHit =
      !query ||
      s.name.toLowerCase().includes(query) ||
      s.tags.some(t => t.toLowerCase().includes(query)) ||
      (s.prefecture ?? "").toLowerCase().includes(query);

    const tagsHit =
      selected.length === 0 ||
      selected.every(sel => s.tags.includes(sel) || s.prefecture === sel);

    return textHit && tagsHit;
  });

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#F6F3EE" }} contentContainerStyle={{ padding:16 }}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text>← 戻る</Text></Pressable>

      <Text style={{ fontSize:22, fontWeight:"700", marginTop:8 }}>検索結果</Text>
      <Text style={{ color:"#666", marginTop:4 }}>キーワード: {q || "なし"}</Text>

      <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:8 }}>
        {selected.map(c => <View key={c} style={styles.tag}><Text style={{ fontSize:12 }}>{c}</Text></View>)}
      </View>

      <View style={{ marginTop:12 }}>
        {filtered.length === 0 && <Text style={{ color:"#666" }}>該当する神社がありませんでした。</Text>}
        {filtered.map(s => (
          <Pressable key={s.id} onPress={() => router.push(`/shrines/${s.id}`)} style={styles.card}>
            <Image source={{ uri: s.imageUrl }} style={{ width: 96, height: 72, borderRadius: 10, marginRight: 12 }} />
            <View style={{ flex:1 }}>
              <Text style={{ fontWeight:"600" }}>{s.name}</Text>
              <Text style={{ color:"#666", marginTop:2, fontSize:12 }}>{s.prefecture}</Text>
              <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:4 }}>
                {s.tags.slice(0,3).map(t => <View key={t} style={styles.miniTag}><Text style={{ fontSize:11 }}>{t}</Text></View>)}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back:{ alignSelf:"flex-start", borderWidth:1, borderColor:"#ddd", paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor:"#fff" },
  tag:{ borderRadius:999, backgroundColor:"#F4F4F5", paddingHorizontal:10, paddingVertical:6, marginRight:8, marginBottom:8 },
  miniTag:{ borderRadius:999, backgroundColor:"#F4F4F5", paddingHorizontal:8, paddingVertical:2, marginRight:6, marginBottom:6 },
  card:{ flexDirection:"row", alignItems:"center", backgroundColor:"#fff", borderWidth:1, borderColor:"#e6e6e6", borderRadius:12, padding:10, marginBottom:10 },
});
