import * as React from "react";
import { Link, useRouter } from "expo-router";
import { ScrollView, View, Text, TextInput, StyleSheet, Pressable } from "react-native";
import { colors } from "./theme";
import Button from "../components/ui/Button";
import SearchChips from "../components/home/SearchChips";
import RankingCarousel from "../components/home/RankingCarousel";
import { SHRINES } from "../data/shrines";
import MyPageCard from "../components/home/MyPageCard";

// 🆕 追加

import NearbyShrines from "../components/home/NearbyShrines";

export default function Home() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [filters, setFilters] = React.useState<string[]>([]);
  const [favOnly, setFavOnly] = React.useState(false);

  const goSearch = () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (filters.length) params.set("filters", filters.join(","));
    router.push(`/search?${params.toString()}`);
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor: colors.paper }} contentContainerStyle={{ paddingBottom: 24 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 12 }}>
        <Text style={{ fontSize: 28, fontWeight:"700" }}>AI参拝ナビ</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>AIコンシェルジュが最適な参拝ルートをご提案</Text>

        <View style={{ flexDirection:"row", marginTop: 16 }}>
          <Link href="/concierge" asChild>
            <Button title="AIコンシェルジュに相談" variant="primary" style={{ flex:1, marginRight: 12 }} />
          </Link>
        </View>

        <View style={{ marginTop: 16 }}>
          <TextInput
            placeholder="神社名や地域で検索..."
            style={styles.search}
            value={q}
            onChangeText={setQ}
            returnKeyType="search"
            onSubmitEditing={goSearch}
          />
          <Pressable onPress={goSearch} style={[styles.searchBtn, { marginTop: 8 }]}>
            <Text style={{ fontWeight:"600" }}>検索する</Text>
          </Pressable>
        </View>
      </View>

      {/* 既存 */}
      <SearchChips onChange={setFilters} />
      <RankingCarousel items={SHRINES.slice(0, 5)} />

      {/* ▼ 並び順：1) 最近見た → 2) 近くの神社 */}

      <NearbyShrines />

      <MyPageCard />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: { height: 48, borderRadius: 16, borderWidth: 1, borderColor: "#ddd", backgroundColor: "white", paddingHorizontal: 12 },
  searchBtn: { height: 40, borderRadius: 10, alignItems:"center", justifyContent:"center", backgroundColor:"#F2F2F2", borderWidth:1, borderColor:"#e6e6e6" },
});
