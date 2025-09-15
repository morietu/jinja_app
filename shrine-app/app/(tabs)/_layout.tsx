import { Tabs } from "expo-router";
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="index" options={{ title: "人気" }} />
      <Tabs.Screen name="favorites" options={{ title: "お気に入り" }} />
      <Tabs.Screen name="mypage" options={{ title: "マイページ" }} />
    </Tabs>
  );
}
