"use client";

import { HomeHero } from "./HomeHero";
import { HomeActionGrid } from "./HomeActionGrid";

export function HomeMainClient() {
  // 縦の構成順がそのまま階層を表す:
  //   ブランド → 見出し → 相談入力カード(主CTA) → 候補チップ/条件 → 補助導線グリッド
  // 旧実装のような横幅の異なるブロックの散在(ml-2 / ml-auto / max-w-[34rem] 等)は行わない。
  return (
    <div className="space-y-12">
      <HomeHero />
      <HomeActionGrid />
    </div>
  );
}
