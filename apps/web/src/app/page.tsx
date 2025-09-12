// apps/web/src/app/page.tsx
import Hero from "@/components/Hero";
import HomeCards from "@/components/HomeCards";

export default function Page() {
  return (
    <main className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">神社ポータル</h1>
      
      <HomeCards />
    </main>
  );
}
