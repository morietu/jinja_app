"use client";

type Props = {
  setCurrentView: (v: "home" | "consultation" | "route" | "ranking") => void;
};

export default function Hero({ setCurrentView }: Props) {
  return (
    <section className="relative bg-[url('/torii-bg.jpg')] bg-cover bg-center py-32 text-center text-white">
      <h1 className="text-4xl md:text-6xl font-bold mb-6">AI参拝ナビ</h1>
      <div className="space-x-4">
        <button
          onClick={() => setCurrentView("consultation")}
          className="px-6 py-3 bg-pink-500 rounded-lg font-semibold hover:bg-pink-600"
        >
          AIコンシェルジュに相談
        </button>
        <button
          onClick={() => setCurrentView("ranking")}
          className="px-6 py-3 bg-yellow-500 rounded-lg font-semibold hover:bg-yellow-600"
        >
          人気神社を見る
        </button>
      </div>
    </section>
  );
}
