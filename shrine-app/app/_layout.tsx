import { Tabs } from "expo-router";
export default function RootLayout() {
  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="(tabs)" options={{ headerShown: false, title: "Home" }} />
      <Tabs.Screen name="shrine/[id]" options={{ href: null, title: "Shrine" }} />
    </Tabs>
  );
}
