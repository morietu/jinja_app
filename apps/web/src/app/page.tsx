// src/app/page.tsx
import HomeCards from "@/components/HomeCards";

export default function HomePage() {
  return (
    <section className="p-6">
      <h1 className="text-2xl font-bold mb-4">神社ナビ</h1>
      <HomeCards />
    </section>
  );
}
