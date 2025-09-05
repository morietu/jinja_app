import * as React from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function Profile() {
  const router = useRouter();
  return (
    <View style={{ flex:1, alignItems:"center", justifyContent:"center", backgroundColor:"#F6F3EE", padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>マイページ（仮）</Text>
      <Text style={{ color:"#666", marginTop:6 }}>ここにプロフィールや御朱印一覧などを配置します。</Text>
      <Pressable
        onPress={() => router.back()}
        style={{ marginTop:16, paddingVertical:10, paddingHorizontal:12, borderRadius:12, borderWidth:1, borderColor:"#ddd", backgroundColor:"#fff" }}
      >
        <Text>← 戻る</Text>
      </Pressable>
    </View>
  );
}
