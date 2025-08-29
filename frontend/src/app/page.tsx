"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Hero from "@/components/Hero";
import Features from "@/components/Features";

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?keyword=${encodeURIComponent(query)}`);
  };

  return (
    <main className="p-4 space-y-12">
      {/* ヒーロー */}
      <Hero />

      {/* 機能メニュー */}
      <Features />

      {/* 🔍 検索バー */}
      <section className="flex justify-center mt-8">
        <form onSubmit={handleSearch} className="flex gap-2 w-full max-w-md">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="神社名や地域で検索..."
            className="border rounded p-2 flex-1"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            検索
          </button>
        </form>
      </section>
    </main>
  );
}
