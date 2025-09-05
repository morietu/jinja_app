import * as React from "react";
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from "react-native";

export default function Profile() {
  const [name, setName] = React.useState("");
  const [pref, setPref] = React.useState("");
  const [purpose, setPurpose] = React.useState(""); // 例: ご利益の傾向

  const save = () => {
    // まずはローカル保存（後で Supabase へ置換）
    localStorage?.setItem?.("ai-sanpai-profile", JSON.stringify({ name, pref, purpose }));
    alert("保存しました（仮）");
  };

  return (
    <ScrollView style={{ flex:1, backgroundColor:"#F6F3EE" }} contentContainerStyle={{ padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:"700" }}>マイページ</Text>
      <View style={styles.card}>
        <Text style={styles.label}>ニックネーム</Text>
        <TextInput value={name} onChangeText={setName} placeholder="例）えつこ" style={styles.input} />

        <Text style={styles.label}>主な活動エリア</Text>
        <TextInput value={pref} onChangeText={setPref} placeholder="例）東京都" style={styles.input} />

        <Text style={styles.label}>よく参拝する目的</Text>
        <TextInput value={purpose} onChangeText={setPurpose} placeholder="例）縁結び・厄除け" style={styles.input} />

        <Pressable onPress={save} style={styles.save}><Text style={{ fontWeight:"700" }}>保存</Text></Pressable>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  card:{ backgroundColor:"#fff", borderWidth:1, borderColor:"#e6e6e6", borderRadius:12, padding:12, marginTop:12 },
  label:{ marginTop:10, marginBottom:6, color:"#555", fontSize:12 },
  input:{ height:44, borderWidth:1, borderColor:"#e6e6e6", borderRadius:10, paddingHorizontal:10, backgroundColor:"#fff" },
  save:{ marginTop:14, height:44, alignItems:"center", justifyContent:"center", borderRadius:10, backgroundColor:"#F2F2F2", borderWidth:1, borderColor:"#e6e6e6" },
});
