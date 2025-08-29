"use client";

import { Button } from "@/components/ui/button";

type Props = {
  setCurrentView: (v: "home" | "consultation" | "route" | "ranking") => void;
};

export default function Hero({ setCurrentView }: Props) {
  return (
    <section className="relative bg-[url('/torii-bg.jpg')] bg-cover bg-center py-32 text-center text-white">
      <div className="absolute inset-0 bg-black/40" /> {/* オーバーレイ */}
      <div className="relative z-10">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 drop-shadow-lg">
          AI参拝ナビ
        </h1>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={() => setCurrentView("consultation")}
            className="bg-pink-500 hover:bg-pink-600 text-white font-semibold px-8 py-4 text-lg"
          >
            AIコンシェルジュに相談
          </Button>
          <Button
            onClick={() => setCurrentView("ranking")}
            className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold px-8 py-4 text-lg"
          >
            人気神社を見る
          </Button>
        </div>
      </div>
    </section>
  );
}
