// apps/mobile/app/mypage/index.tsx
import * as React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import { Link, useFocusEffect } from "expo-router";
import PopularShrineCard from "../../components/PopularShrineCard";
import { CardSkeleton } from "../../components/Skeletons";
import { getRecentViewed } from "../shrines/storage"; // ← 既存の閲覧履歴ユーティリティを想定

type RecentItem = {
  id: number | string;
  name: string;
  address?: string;
  rating?: number;
  photo_url?: string;
  popularity?: number;
};

export default function MyPage() {
  const [items, setItems] = React.useState<RecentItem[] | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const list = await getRecentViewed(); // 例: [{ id, name, address, photo_url, rating }]
      setItems(Array.isArray(list) ? list : []);
    } catch {
      setItems([]); // 読み込み失敗時は空扱い（ここでエラーUIにしてもOK）
    }
  }, []);

  // 画面に戻ってきた時も最新を読みにいく
  useFocusEffect(
    React.useCallback(() => {
      let alive = true;
      (async () => {
        await load();
      })();
      return () => {
        alive = false;
      };
    }, [load])
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* ヘッダー */}
      <Text style={styles.h1}>マイページ</Text>

      {/* 最近見た神社 */}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.h2}>最近見た神社</Text>
          <Link href="/search" asChild>
            <Text style={styles.link}>神社を探す</Text>
          </Link>
        </View>

        {/* ローディング */}
        {items === null && (
          <View style={{ flexDirection: "row", marginTop: 8 }}>
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </View>
        )}

        {/* 空状態 */}
        {items?.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>まだ閲覧履歴がありません</Text>
            <Text style={styles.emptyText}>
              ホームや検索から神社を見てみましょう
            </Text>
          </View>
        )}

        {/* 横スクロールリスト */}
        {items && items.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalList}
          >
            {items.map((s) => (
              <PopularShrineCard
                key={String(s.id)}
                id={s.id}
                name={s.name}
                address={s.address}
                rating={s.rating}
                photo_url={s.photo_url}
                popularity={s.popularity}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, backgroundColor: "#F6F3EE" },
  h1: { fontSize: 22, fontWeight: "700", marginBottom: 12 },
  section: { marginTop: 8 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  h2: { fontSize: 18, fontWeight: "700" },
  link: { color: "#2f6ee5", fontWeight: "600" },
  empty: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  emptyTitle: { fontWeight: "700", marginBottom: 4 },
  emptyText: { color: "#666" },
  horizontalList: { paddingVertical: 8, paddingRight: 4, gap: 12 },
});
