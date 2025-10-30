import { cookies } from "next/headers";
export async function POST() {
  const jar = await cookies();
  jar.set("access_token", "", { httpOnly: true, path: "/", maxAge: 0 });
  jar.set("refresh_token","", { httpOnly: true, path: "/", maxAge: 0 });
  return new Response(null, { status: 200 });
}
