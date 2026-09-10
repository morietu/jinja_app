import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { kamimusubiDark as theme } from "../../design/theme";
import { getFavoriteShrines, getRecentViewed } from "../../lib/shrineStorage";
import { getCounts } from "../../lib/storage";
import { getAuthenticatedBillingStatus, isPremiumStatus, type BillingStatus } from "../../lib/billing";
import { isUnauthenticatedError } from "../../lib/http";
import { trackConsultationHistoryEntryClicked } from "../../lib/consultationHistoryAnalytics";

// ---- お問い合わせ (Mother Ship承認済みの契約) ----
// 宛先と件名は可読な定数として保持する。
const CONTACT_EMAIL = "j33db05@gmail.com";
const CONTACT_SUBJECT = "KAMI MUSUBI お問い合わせ";

// クエリ値は UTF-8 の完全な percent-encode とする。生の日本語を置くと
// URLの解釈がメーラー任せになり件名が化ける端末が出るため、
// 長いpercent文字列を手書きせず encodeURIComponent で構築して取りこぼしを防ぐ。
//
// 実際に生成される文字列:
//   mailto:j33db05@gmail.com?subject=KAMI%20MUSUBI%20%E3%81%8A%E5%95%8F%E3%81%84%E5%90%88%E3%82%8F%E3%81%9B
const CONTACT_MAILTO_URL = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(CONTACT_SUBJECT)}`;

// メールアプリが未設定の端末では openURL が reject する。
// UI(文言・レイアウト・カード構造)は変えない方針のため、ここでは
// rejectを未処理のまま残さないことだけを保証する
// (既存の app/shrines/[id].tsx と同じ扱い)。
function openContactMail() {
  Linking.openURL(CONTACT_MAILTO_URL).catch(() => {});
}

type PremiumMetaState =
  | { kind: "loading" }
  | { kind: "unauthenticated" }
  | { kind: "error" }
  | { kind: "ready"; status: BillingStatus };

// billing.ts の isPremiumStatus をそのまま利用し、Free/Premium判定ロジックはここで持たない。
function describePremiumMeta(state: PremiumMetaState): string {
  if (state.kind === "loading") return "確認中...";
  if (state.kind === "unauthenticated") return "ログインすると確認できます";
  if (state.kind === "error") return "登録状況を確認できませんでした";
  return isPremiumStatus(state.status) ? "Premium登録済み" : "現在はFreeプラン";
}

type MyPageCardProps = {
  title: string;
  description: string;
  meta?: string;
  iconText: string;
  actionLabel?: string;
  onPress?: () => void;
};

type UsageStatProps = {
  label: string;
  value: string;
  helper: string;
};

function MyPageCard({ title, description, meta, iconText, actionLabel, onPress }: MyPageCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole={onPress ? "button" : undefined}
    >
      <View style={styles.iconBox}>
        <Text style={styles.iconText}>{iconText}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
        {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
      </View>
      {actionLabel ? (
        <View style={styles.cardAction}>
          <Text style={styles.cardActionText}>{actionLabel}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function UsageStat({ label, value, helper }: UsageStatProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statHelper}>{helper}</Text>
    </View>
  );
}

export default function MyPageScreen() {
  const router = useRouter();
  const [favoriteCount, setFavoriteCount] = React.useState<number | null>(null);
  const [recentCount, setRecentCount] = React.useState<number | null>(null);
  const [visitCount, setVisitCount] = React.useState<number | null>(null);
  const [premiumMeta, setPremiumMeta] = React.useState<PremiumMetaState>({ kind: "loading" });

  React.useEffect(() => {
    let mounted = true;

    getAuthenticatedBillingStatus()
      .then((status) => {
        if (!mounted) return;
        setPremiumMeta(status ? { kind: "ready", status } : { kind: "error" });
      })
      .catch((error) => {
        if (!mounted) return;
        setPremiumMeta(isUnauthenticatedError(error) ? { kind: "unauthenticated" } : { kind: "error" });
      });

    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    let mounted = true;

    getFavoriteShrines()
      .then((items) => {
        if (mounted) setFavoriteCount(items.length);
      })
      .catch(() => {
        if (mounted) setFavoriteCount(0);
      });

    getRecentViewed(20)
      .then((items) => {
        if (mounted) setRecentCount(items.length);
      })
      .catch(() => {
        if (mounted) setRecentCount(0);
      });

    getCounts()
      .then(({ visits }) => {
        if (mounted) setVisitCount(visits);
      })
      .catch(() => {
        if (mounted) setVisitCount(0);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MY PAGE</Text>
        <Text style={styles.title}>マイページ</Text>
        <Text style={styles.subtitle}>
          プロフィール、Premium、設定をここから確認できます。
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>プロフィール</Text>
        <MyPageCard
          title="プロフィールカード"
          description="生年月日や出生情報、参拝スタイルを設定できます。"
          meta="入力内容は神社提案の補助情報として使われます。"
          iconText="人"
          actionLabel="確認"
          onPress={() => router.push("/profile")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>利用状況</Text>
        <View style={styles.usageGrid}>
          <UsageStat
            label="お気に入り"
            value={favoriteCount === null ? "..." : `${favoriteCount}`}
            helper="保存した神社"
          />
          <UsageStat
            label="参拝回数"
            value={visitCount === null ? "..." : `${visitCount}`}
            helper="記録された参拝"
          />
          <UsageStat
            label="最近見た神社"
            value={recentCount === null ? "..." : `${recentCount}`}
            helper="閲覧履歴"
          />
          <UsageStat
            label="御朱印"
            value="0"
            helper="次フェーズで連携"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>相談</Text>
        <MyPageCard
          title="相談履歴"
          description="これまでの相談と、当時推薦された神社を見返せます。"
          iconText="談"
          actionLabel="開く"
          onPress={() => {
            trackConsultationHistoryEntryClicked();
            router.push("/consultation-history");
          }}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Premium</Text>
        <MyPageCard
          title="Premium"
          description="前回比較、深い振り返り、保存した相談の整理を使えるようにします。"
          meta={describePremiumMeta(premiumMeta)}
          iconText="P"
          actionLabel="確認"
          onPress={() => router.push("/premium")}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>設定・サポート</Text>
        <MyPageCard
          title="設定"
          description="通知や表示設定を確認する場所です。"
          meta="準備中"
          iconText="設"
          actionLabel="開く"
        />
        <MyPageCard
          title="利用規約"
          description="アプリの利用条件を確認できます。"
          iconText="規"
          actionLabel="確認"
        />
        <MyPageCard
          title="お問い合わせ"
          description="不具合や相談がある場合の連絡先です。"
          iconText="問"
          actionLabel="送る"
          onPress={openContactMail}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
    gap: 22,
  },
  header: {
    gap: 8,
  },
  eyebrow: {
    color: theme.goldSoft,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  title: {
    color: theme.gold,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  subtitle: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "600",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: theme.goldSoft,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  usageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    width: "48%",
    minHeight: 104,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderHeader,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: "space-between",
  },
  statValue: {
    color: theme.gold,
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  statLabel: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 8,
  },
  statHelper: {
    color: theme.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.borderHeader,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  cardPressed: {
    opacity: 0.72,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.borderGold,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceSoft,
  },
  iconText: {
    color: theme.gold,
    fontSize: 18,
    fontWeight: "900",
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "900",
  },
  cardDescription: {
    color: theme.mutedSoft,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  cardMeta: {
    color: theme.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  cardAction: {
    borderWidth: 1,
    borderColor: theme.borderGold,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  cardActionText: {
    color: theme.gold,
    fontSize: 11,
    fontWeight: "800",
  },
});
