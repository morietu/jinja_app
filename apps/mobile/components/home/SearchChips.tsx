// apps/mobile/components/home/SearchChips.tsx
import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { colors } from "../../app/theme";

const CANDS = {
  地域: ["東京都", "京都府"],
  ご利益: ["縁結び", "厄除け", "合格祈願", "商売繁盛"],
  混雑: ["空いている"],
  所要時間: ["30分以内"],
} as const;

export default function SearchChips({ onChange }: { onChange?: (v: string[]) => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (k: string) => {
    const next = selected.includes(k) ? selected.filter(x => x !== k) : [...selected, k];
    setSelected(next); onChange?.(next);
  };

  return (
    <View style={styles.wrap}>
      {(Object.keys(CANDS) as Array<keyof typeof CANDS>).map(group => (
        <View key={group} style={{ marginBottom: 12 }}>
          <Text style={styles.groupLabel}>{group}</Text>
          <View style={styles.rowWrap}>
            {CANDS[group].map(label => {
              const active = selected.includes(label);
              return (
                <Pressable
                  key={label}
                  onPress={() => toggle(label)}
                  style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                >
                  <Text style={active ? styles.chipTextActive : styles.chipText}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16 },
  groupLabel: { marginBottom: 4, fontSize: 12, color: "#6b7280" },
  rowWrap: { flexDirection: "row", flexWrap: "wrap" },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  chipInactive: { borderWidth: 1, borderColor: "#d1d5db", backgroundColor: "white" },
  chipActive: { backgroundColor: "#111" },
  chipText: { color: "#111" },
  chipTextActive: { color: "white" },
});
