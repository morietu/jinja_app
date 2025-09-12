// app/index.tsx
import { Link } from "expo-router";
import { View, Text } from "react-native";

export default function Home() {
  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>AI参拝ナビ</Text>
      <Link href="/ranking">人気神社ランキングへ</Link>
    </View>
  );
}
