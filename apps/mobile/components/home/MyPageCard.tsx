import * as React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Link, useFocusEffect } from "expo-router";
import { getCounts } from "../../lib/storage";

export default function MyPageCard() {
  const [counts, setCounts] = React.useState({ favorites: 0, visits: 0, stamps: 0 });

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        const c = await getCounts();
        if (alive) setCounts(c);
      })();
      return () => { alive = false; };
    }, [])
  );

  return (
    <View style={styles.card}>
      <Text style={{ fontWeight: "700" }}>マイページ</Text>
      <Text style={{ color: "#666", marginTop: 4, fontSize: 12 }}>
        御朱印の登録・お気に入り管理・参拝履歴
      </Text>

      <View style={styles.metrics}>
        <View style={styles.pill}><Text style={styles.pillText}>♡ {counts.favorites}</Text></View>
        <View style={styles.pill}><Text style={styles.pillText}>参拝 {counts.visits}</Text></View>
        <View style={styles.pill}><Text style={styles.pillText}>御朱印 {counts.stamps}</Text></View>
      </View>

      <View style={{ flexDirection: "row", marginTop: 12 }}>
        <Link href="/goshuin/upload" asChild>
          <Pressable style={styles.btnPrimary}><Text style={styles.btnTextDark}>御朱印を登録</Text></Pressable>
        </Link>
        {/* 任意：一覧を見る導線 */}
        <View style={{ width: 8 }} />
        <Link href="/goshuin" asChild>
          <Pressable style={styles.btn}><Text style={styles.btnText}>一覧を見る</Text></Pressable>
        </Link>
      </View>

      <View style={{ width: 8 }} />

  {/* ★ マイページ（プロフィール）を開く */}
  <Link href="/profile" asChild>
    <Pressable style={styles.btn}><Text style={styles.btnText}>開く</Text></Pressable>
  </Link>
    </View>
  );
}


const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e6e6e6",
    borderRadius: 12,
    padding: 12,
  },
  title: { fontWeight: "700" },
  sub: { color: "#666", marginTop: 4, fontSize: 12 },
  metrics:{ flexDirection:"row", marginTop:12 },
  pill:{ marginRight:8, backgroundColor:"#F4F4F5", borderRadius:999, paddingHorizontal:10, paddingVertical:6 },
  pillText:{ fontSize:12 },
  btn: {
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#F2C94C",
    borderWidth: 1,
    borderColor: "#e6e6e6",
  },
  btnPrimary:{ height:44, paddingHorizontal:14, alignItems:"center", justifyContent:"center", borderRadius:10, backgroundColor:"#F2C94C", borderWidth:1, borderColor:"#e6e6e6" },
  btnText: { fontWeight: "700", color: "#111" },
  btnTextDark:{ fontWeight:"700", color:"#111" },
});
