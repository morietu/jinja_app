// apps/mobile/app/goshuin/index.tsx
import * as React from "react";
import { View, Text, Image, Pressable, StyleSheet, ScrollView, Dimensions } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getStamps } from "../../lib/storage";

const GAP = 8;
const COLS = 3;
const W = (Dimensions.get("window").width - 16*2 - GAP*(COLS-1)) / COLS;

export default function GoshuinList() {
  const router = useRouter();
  const [stamps, setStamps] = React.useState<{id:string;uri:string;createdAt:number}[]>([]);

  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        const list = await getStamps();
        if (alive) setStamps(list);
      })();
      return () => { alive = false; };
    }, [])
  );

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#F6F3EE" }} contentContainerStyle={{ padding:16 }}>
      <Pressable onPress={() => router.back()} style={styles.back}><Text>← 戻る</Text></Pressable>
      <Text style={{ fontSize:22, fontWeight:"700", marginTop:8 }}>御朱印一覧</Text>
      <Text style={{ color:"#666", marginTop:4 }}>{stamps.length} 件</Text>

      <View style={{ flexDirection:"row", flexWrap:"wrap", marginTop:12 }}>
        {stamps.map((s, idx) => (
          <Image key={s.id} source={{ uri: s.uri }} style={{
            width: W, height: W * 4/3, borderRadius:10,
            marginRight: (idx % COLS) === (COLS-1) ? 0 : GAP,
            marginBottom: GAP
          }} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back:{ alignSelf:"flex-start", borderWidth:1, borderColor:"#ddd", paddingVertical:8, paddingHorizontal:12, borderRadius:10, backgroundColor:"#fff" },
});
