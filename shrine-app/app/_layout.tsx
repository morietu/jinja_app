import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack>
      {/* タブグループはヘッダー非表示（タブ側で出す） */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* 詳細画面はここで登録（タブの外） */}
      <Stack.Screen name="shrine/[id]" options={{ title: "神社詳細" }} />
    </Stack>
  );
}
