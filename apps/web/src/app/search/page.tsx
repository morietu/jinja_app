
import PlaceSuggestBox from "@/components/PlaceSuggestBox";

export default function SearchPage() {
  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">神社を検索</h1>
      <PlaceSuggestBox />
    </main>
  );
}
