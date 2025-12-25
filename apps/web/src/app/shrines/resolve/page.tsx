import { redirect } from "next/navigation";

export default function Page({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const keywordRaw = searchParams.keyword ?? "";
  const keyword = Array.isArray(keywordRaw) ? keywordRaw[0] : keywordRaw;

  const locationbiasRaw = searchParams.locationbias ?? "";
  const locationbias = Array.isArray(locationbiasRaw) ? locationbiasRaw[0] : locationbiasRaw;

  const usp = new URLSearchParams();
  if (keyword) usp.set("keyword", keyword);
  if (locationbias) usp.set("locationbias", locationbias);

  const qs = usp.toString();
  redirect(qs ? `/search?${qs}` : "/search");
}
