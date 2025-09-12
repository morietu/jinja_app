import * as React from "react";
import { KeyboardAvoidingView, Platform, View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";

type Msg = { id: string; role: "user" | "assistant"; content: string };

export default function Concierge() {
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<Msg[]>([
    { id: "sys1", role: "assistant", content: "こんにちは。参拝の目的や地域、所要時間など教えてください。" }
  ]);

  const send = () => {
    if (!input.trim()) return;
    const userMsg: Msg = { id: String(Date.now()), role: "user", content: input.trim() };
    // いまはダミー応答
    const aiMsg: Msg = { id: String(Date.now()+1), role: "assistant", content: "了解しました。候補を検索します。（ダミー）" };
    setMessages(prev => [...prev, userMsg, aiMsg]);
    setInput("");
  };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:"#F6F3EE" }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding:16, paddingBottom:96 }}>
        {messages.map(m => (
          <View key={m.id} style={[styles.bubble, m.role === "user" ? styles.user : styles.assistant]}>
            <Text style={{ color: m.role === "user" ? "#fff" : "#111" }}>{m.content}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.inputBar}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="例）縁結びで、渋谷から1時間以内"
          style={styles.input}
          multiline
        />
        <Pressable onPress={send} style={styles.sendBtn}>
          <Text style={{ color:"#111", fontWeight:"700" }}>送信</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  bubble:{ maxWidth:"80%", borderRadius:12, padding:10, marginBottom:10 },
  user:{ alignSelf:"flex-end", backgroundColor:"#111" },
  assistant:{ alignSelf:"flex-start", backgroundColor:"#fff", borderWidth:1, borderColor:"#e6e6e6" },
  inputBar:{ position:"absolute", left:0, right:0, bottom:0, flexDirection:"row", gap:8, padding:12, backgroundColor:"#F6F3EE", borderTopWidth:1, borderColor:"#e6e6e6" },
  input:{ flex:1, minHeight:44, maxHeight:120, backgroundColor:"#fff", borderWidth:1, borderColor:"#e6e6e6", borderRadius:10, paddingHorizontal:10, paddingVertical:8 },
  sendBtn:{ height:44, paddingHorizontal:14, alignItems:"center", justifyContent:"center", borderRadius:10, backgroundColor:"#F2C94C", borderWidth:1, borderColor:"#e6e6e6" },
});
