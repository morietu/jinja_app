import React from "react";
import { View, Text } from "react-native";

export const Spacer = ({ h = 12 }: { h?: number }) => <View style={{ height: h }} />;

export const Section = ({
  title,
  children,
  top = 12,
  bottom = 12,
}: { title?: string; children: React.ReactNode; top?: number; bottom?: number }) => (
  <View style={{ paddingHorizontal: 16, paddingTop: top, paddingBottom: bottom }}>
    {title ? <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{title}</Text> : null}
    {children}
  </View>
);
