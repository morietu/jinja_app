import { Stack } from 'expo-router';
export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="shrine/[id]" options={{ title: 'Shrine' }} />
      <Stack.Screen name="concierge/plan" options={{ title: 'Plan' }} />
    </Stack>
  );
}
