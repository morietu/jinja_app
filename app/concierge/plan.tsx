import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getConciergePlan } from '../../lib/api';

export default function Plan(){
  const [plan, setPlan] = useState<any>(null);
  useEffect(()=>{ getConciergePlan().then(setPlan).catch(console.error); },[]);
  return <View style={{padding:16}}>
    <Text style={{fontSize:18, fontWeight:'600'}}>おすすめプラン</Text>
    <Text style={{marginTop:8, lineHeight:20}}>{plan?.text ?? '生成中/未設定'}</Text>
  </View>;
}
