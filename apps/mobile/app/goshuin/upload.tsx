// apps/mobile/app/goshuin/upload.tsx
import * as React from "react";
import * as ImagePicker from "expo-image-picker";
import { View, Text, Pressable, Image, StyleSheet, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { pushStamp } from "../../lib/storage";

export default function GoshuinUpload() {
  const router = useRouter();
  const [uri, setUri] = React.useState<string | null>(null);

  // 権限リクエストだけを行う
  const ask = React.useCallback(async () => {
    await ImagePicker.requestCameraPermissionsAsync();
    await ImagePicker.requestMediaLibraryPermissionsAsync();
  }, []);

  React.useEffect(() => {
    ask();
  }, [ask]);

  const pickFromLibrary = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (!res.canceled) setUri(res.assets[0].uri);
  };

  const takePhoto = async () => {
    const res = await ImagePicker.launchCameraAsync({ quality: 0.9 });
    if (!res.canceled) setUri(res.assets[0].uri);
  };

  const save = async () => {
    if (!uri) return;
    await pushStamp(uri);
    Alert.alert("保存しました");
    router.back();
  };

  // JSX はここだけ
  return (
    <ScrollView contentContainerStyle={{ padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>御朱印を登録</Text>
      <Text style={{ color: "#555", marginTop: 6 }}>
        カメラで撮影、またはアルバムから選択してください。
      </Text>

      <View style={{ flexDirection: "row", marginTop: 12 }}>
        <Pressable onPress={takePhoto} style={[styles.btn, { marginRight: 8 }]}>
          <Text style={styles.btnText}>カメラ</Text>
        </Pressable>
        <Pressable onPress={pickFromLibrary} style={styles.btn}>
          <Text style={styles.btnText}>アルバム</Text>
        </Pressable>
      </View>

      {uri && (
        <View style={{ marginTop: 16 }}>
          <Image source={{ uri }} style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: 12 }} />
          <Pressable onPress={save} style={[styles.btnPrimary, { marginTop: 12 }]}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>保存する</Text>
          </Pressable>
        </View>
      )}

      <Pressable onPress={() => router.back()} style={[styles.btn, { marginTop: 16 }]}>
        <Text style={styles.btnText}>← 戻る</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 44,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    backgroundColor: "#F2F2F2",
  },
  btnText: { fontWeight: "700", color: "#111" },
  btnPrimary: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "#E24E33",
  },
});
