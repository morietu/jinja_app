import api from "./client";
import { Shrine } from "./shrines";

export type Visit = {
  id: number;
  shrine: Shrine;
  visited_at: string;
  note?: string;
  status?: string;
};

// 参拝チェックイン（トグル）
export async function addVisit(shrineId: number) {
  const res = await api.post(`/shrines/${shrineId}/visit/`);
  return res.data;
}

// 参拝履歴一覧
export async function getVisits(): Promise<Visit[]> {
  const res = await api.get("/visits/");
  return res.data;
}
