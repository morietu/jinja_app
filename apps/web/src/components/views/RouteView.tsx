"use client";

type Props = {
  onBack: () => void;
};

export default function RouteView({ onBack }: Props) {
  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-blue-500">
        ← 戻る
      </button>
      <h2 className="text-2xl font-bold mb-4">最適ルート検索</h2>
      <p>ここに地図やルート検索の機能を実装予定です。</p>
    </div>
  );
}
