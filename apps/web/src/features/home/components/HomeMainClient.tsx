"use client";

import { HomeHero } from "./HomeHero";
import { HomeActionGrid } from "./HomeActionGrid";
import { HomeContactFooter } from "./HomeContactFooter";

export function HomeMainClient() {
  // 縦の構成順がそのまま階層を表す:
  //   ブランド → 見出し → 相談入力カード(主CTA) → 候補チップ/条件 → 補助導線グリッド → 連絡導線
  // 旧実装のような横幅の異なるブロックの散在(ml-2 / ml-auto / max-w-[34rem] 等)は行わない。
  // 連絡導線は最後に置き、主要導線への従属を並び順でも示す。
  return (
    <div className="space-y-12">
      <HomeHero />
      <HomeActionGrid />
      <HomeContactFooter />
    </div>
  );
}
