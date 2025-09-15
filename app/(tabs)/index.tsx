import { useEffect, useState } from 'react';
import { View, Text, FlatList, Pressable } from 'react-native';
import { Link } from 'expo-router';
import { getPopularShrines } from '../../lib/api';

export default function Home() {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => { getPopularShrines().then(setData).catch(console.error); }, []);
  return (
    <View style={{ padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: '600', marginBottom: 8 }}>人気の神社</Text>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id ?? item.place_id ?? Math.random())}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/shrine/[id]', params: { id: item.id ?? item.place_id } }} asChild>
            <Pressable><Text style={{ paddingVertical: 8 }}>{item.name ?? item.title ?? '神社'}</Text></Pressable>
          </Link>
        )}
        ListEmptyComponent={<Text>読み込み中/データなし</Text>}
      />
      <Link href="/concierge/plan" asChild>
        <Pressable style={{ marginTop: 16 }}>
          <Text style={{ color: 'blue' }}>AIプランを見る</Text>
        </Pressable>
      </Link>
    </View>
  );
}
