"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Hero() {
  return (
    <section className="relative bg-[url('/torii-bg.jpg')] bg-cover bg-center py-32 text-center text-white">
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-lg">
          AI参拝ナビ
        </h1>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-8 py-4 text-lg">
            <Link href="/consultation">AIコンシェルジュに相談</Link>
          </Button>
          <Button asChild className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8 py-4 text-lg">
            <Link href="/ranking">人気神社を見る</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
