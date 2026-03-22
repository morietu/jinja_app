// apps/web/src/lib/schemas/api.ts
import { z } from "zod";

// 共通
export const ShrineLite = z.object({
  id: z.number().int(),
  name: z.string(),
  lat: z.number(),
  lng: z.number(),
  address: z.string().nullable().optional(),
});
export type ShrineLite = z.infer<typeof ShrineLite>;

// /populars/
export const PopularItem = z.object({
  shrine: ShrineLite,
  score: z.number(),
  period_days: z.number().int().optional(), // 最小形なので任意
});
export const PopularsResponse = z.object({
  items: z.array(PopularItem),
});
export type PopularsResponse = z.infer<typeof PopularsResponse>;

// /shrines/nearest/
export const NearestItem = z.object({
  shrine: ShrineLite,
  distance_m: z.number().int(),
  walking_minutes: z.number().nullable().optional(),
  driving_minutes: z.number().nullable().optional(),
});
export const NearestResponse = z.object({
  items: z.array(NearestItem),
});
export type NearestResponse = z.infer<typeof NearestResponse>;


// /directions/
export const DirectionsResponse = z.object({
  mode: z.enum(["walking", "driving"]),
  distance_m: z.number().int(),
  duration_min: z.number(),
  polyline: z.string(), // エンコード済み
});
export type DirectionsResponse = z.infer<typeof DirectionsResponse>;
