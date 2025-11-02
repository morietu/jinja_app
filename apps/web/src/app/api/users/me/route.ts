// apps/web/src/app/api/users/me/route.ts
// /api/me の実装をそのまま再利用（エイリアス）
export { GET } from "../../me/route";
export const dynamic = "force-dynamic";
export const revalidate = 0;
