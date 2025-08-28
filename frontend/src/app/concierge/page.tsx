"use client";

import { useState } from "react";
import { getConciergeRecommendation, ConciergeResponse } from "@/lib/api/concierge";

export default function ConciergePage() {
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [theme, setTheme] = useState("");
  const [result, setResult] = useState<ConciergeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const year = parseInt(birthYear, 10);
      const month = birthMonth ? parseInt(birthMonth, 10) : undefined;
      const day = birthDay ? parseInt(birthDay, 10) : undefined;

      if (isNaN(year)) {
        setError("西暦を入力してください");
        setLoading(false);
        return;
      }
      const res = await getConciergeRecommendation(year, month, day, theme);
      setResult(res);
    } catch (err) {
      console.error(err);
      setError("診断に失敗しました");
    } finally {
      setLoading(false);
    }
  };

 return (
    <main className="p-4 space-y-6">
      <h1 className="text-xl font-bold">AI神社コンシェルジュ</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="年 (例: 1990)"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
            className="border rounded p-2 w-1/3"
          />
          <input
            type="number"
            placeholder="月"
            value={birthMonth}
            onChange={(e) => setBirthMonth(e.target.value)}
            className="border rounded p-2 w-1/4"
          />
          <input
            type="number"
            placeholder="日"
            value={birthDay}
            onChange={(e) => setBirthDay(e.target.value)}
            className="border rounded p-2 w-1/4"
          />
        </div>
        <div>
          <input
            type="text"
            placeholder="相談テーマ (例: 恋愛, 仕事, 健康)"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          {loading ? "診断中..." : "診断する"}
        </button>
      </form>

      {error && <p className="text-red-500">{error}</p>}
      {result && (
        <div className="border p-4 rounded bg-gray-50">
          <h2 className="text-lg font-semibold">おすすめ神社</h2>
          <p className="text-xl">{result.recommendation}</p>
          <p className="text-sm text-gray-600 mt-2">{result.reason}</p>
          <div className="flex gap-2 mt-2">
            {result.tags.map((tag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
