// apps/mobile/components/ui/Button.tsx
import { Pressable, Text, StyleSheet, ViewStyle } from "react-native";
import { colors } from "../../app/theme";

type Props = {
  title: string;
  variant?: "primary" | "accent" | "neutral";
  style?: ViewStyle;
  onPress?: () => void;
};
export default function Button({ title, variant="neutral", style, onPress }: Props) {
  const theme =
    variant === "primary" ? styles.btnPrimary :
    variant === "accent"  ? styles.btnAccent  : styles.btnNeutral;
  const textStyle =
    variant === "accent" ? styles.btnAccentText : styles.btnText;
  return (
    <Pressable onPress={onPress} style={[styles.btn, theme, style]}>
      <Text style={[styles.btnTextBase, textStyle]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { backgroundColor: colors.primary },
  btnAccent:  { backgroundColor: colors.accent },
  btnNeutral: { backgroundColor: "#111" },
  btnTextBase:{ fontWeight: "600", fontSize: 16 },
  btnText:    { color: "white" },
  btnAccentText:{ color: colors.text },
});
