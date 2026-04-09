import RegisterForm from "../../signup/RegisterForm";
import { sanitizeReturnTo } from "@/lib/nav/login";

function stripRscParam(returnTo: string): string {
  try {
    const url = new URL(returnTo, "http://dummy");
    url.searchParams.delete("_rsc");
    return url.pathname + url.search;
  } catch {
    return returnTo;
  }
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>;
}) {
  const sp = (await searchParams) ?? {};
  const raw = sp["returnTo"];
  const returnToRaw = Array.isArray(raw) ? raw[0] : raw;

  const cleaned = typeof returnToRaw === "string" ? stripRscParam(returnToRaw) : null;
  const returnTo = sanitizeReturnTo(cleaned);

  return <RegisterForm next={returnTo} />;
}
