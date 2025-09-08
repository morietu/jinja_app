// components/home/NearbyShrines.tsx
import * as React from "react";
import { View, Text, Pressable } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SHRINES } from "../../data/shrines";

function haversine(lat1:number, lon1:number, lat2:number, lon2:number) {
  const R = 6371e3;
  const toRad = (d:number)=> d*Math.PI/180;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R*c; // meters
}

export default function NearbyShrines() {
  const router = useRouter();
  const [state, setState] = React.useState<{loading:boolean; error?:string; items:any[]}>({loading:true, items:[]});

  React.useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setState({ loading:false, error:"位置情報の権限がありません。", items:[] });
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        const { latitude, longitude } = loc.coords;

        const withDist = SHRINES
          .map(s => ({
            ...s,
            distance: haversine(latitude, longitude, s.latitude, s.longitude),
          }))
          .sort((a,b)=> a.distance - b.distance)
          .slice(0,5);

        setState({ loading:false, items: withDist });
      } catch (e:any) {
        setState({ loading:false, error:"近くの神社を取得できませんでした。", items:[] });
      }
    })();
  }, []);

  return (
    <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 8 }}>近くの神社</Text>

      {state.loading ? (
        <Text style={{ color:"#777" }}>読み込み中...</Text>
      ) : state.error ? (
        <Text style={{ color:"#b00" }}>{state.error}</Text>
      ) : (
        <View>
          {state.items.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => router.push(`/shrines/${s.id}`)}
              style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: "#eee" }}
            >
              <Text style={{ fontWeight: "700" }}>{s.name}</Text>
              <Text style={{ color:"#777" }}>
                {s.address} ・ {(s.distance/1000).toFixed(1)} km
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
