"use client";

type Props = {
  onBack: () => void;
};

export default function ConsultationView({ onBack }: Props) {
  return (
    <div className="p-6">
      <button onClick={onBack} className="mb-4 text-blue-500">
        ← 戻る
      </button>
      <h2 className="text-2xl font-bold mb-4">AIコンシェルジュ</h2>
      <p>ここに診断フォームや結果表示を実装予定です。</p>
    </div>
  );
}
