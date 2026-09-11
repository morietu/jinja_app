// apps/web/src/features/home/components/HomeBackdrop.tsx
//
// Home限定の背景モチーフ — "Japanese Modern Classic / Luminous Path"
//
// 「静かな暗さの中に、次へ進むための小さな光が差す」を、
// 写真・画像を一切使わず CSS gradient と inline SVG だけで構成する。
//
// ■ 構成（下から上へ）
//   1. 地      : Deep Ink Navy (--home-ground)
//   2. 大気    : 上方からの光 + 下部にMoss Charcoalのニュアンス
//   3. 参道    : 波線3本（主線1 + 副線2）
//   4. 光      : 主線上のMain Orb 1個（線の途中に光が宿る表現）
//
// ■ 色
// 新しい色を作るのは地とその上の光だけで、線・光点はいずれも既存の
// brass / champagne gold Token (--home-path / --home-path-lit) を再利用する。
//
// ■ Accessibility
// 全体が装飾。aria-hidden で screen reader から外し、SVGにも
// title/desc を持たせない（不要な読み上げを出さない）。
// pointer-events-none で操作も一切奪わない。
// Animationは持たないため、prefers-reduced-motion で失われる情報もない。
//
// ■ Animation
// 今回は追加しない（仕様上必須ではない）。Animationなしで成立する構図に
// 留めることで、reduced-motion環境と通常環境の見た目を同一に保つ。
//
// ■ Client Boundary
// 本Componentは Server Component である（"use client" を持たない）。
// hooks / state / event handler / browser API のいずれも使わず、
// import も持たない純粋な静的マークアップのため、Clientへ送る必要がない。
// 取り込み側の HomePage.tsx も Server Component なので境界は成立する。
// 装飾レイヤーの分だけClient bundleを増やさないために、この境界を保つこと。
// 将来Animationやinteractionを足す場合は、ここに "use client" を付けるのではなく
// 動く部分だけを別のClient Componentへ切り出す方が影響範囲が小さい。

/*
 * 波線帯の座標系。
 *
 * SVGは preserveAspectRatio="none" で横方向にだけ伸ばし、
 * 線の太さは vector-effect="non-scaling-stroke" で固定する。
 * これにより:
 *   - x は常にビューポート幅に対する比率で解決する (164/390 = 42.05%)
 *   - y は帯の高さを実寸で固定するため 1px = 1 viewBox unit で一致する
 * 結果、375 / 390 / 430px のいずれでもOrbが主線上に正確に乗る。
 *
 * BAND_TOP は Home の内枠上端からの距離。375pxでの実測に基づく。
 *
 * ■ 3本をどこに通すか
 * 本文は電話幅の単一カラムで、Card / Input はいずれもマットな不透明面
 * (Glassmorphism禁止) である。したがってカードの裏を通る線は「無い線」に
 * なってしまい、3本の明るさの階層が読めない。
 * そこで実測した「背景が素で見える帯」に1本ずつ通し、3本すべてが
 * 実際に視認できるようにする。
 *   home基準の実測値:
 *     入力カード下端 ≈ 457 / チップ見出し ≈ 492  → 空き帯 (主線 + Orb)
 *     チップ群 ≈ 527〜672                        → pillの隙間 (副線2)
 *     条件を追加する 〜 ANOTHER WAY IN ≈ 720〜780 → 空き帯 (副線1)
 * 文字の上を通るのは最も低いopacityの副線2だけに限定する。
 */
const BAND_TOP = 280;
const BAND_HEIGHT = 660;
const VIEW_W = 390;

/** Main Orbの位置。主線 MAIN_PATH の通過点と一致させる。 */
const ORB_X = 164;
const ORB_Y = 190;

/*
 * 3本の波線。
 *
 * 制約:
 *   - 横方向〜緩やかな斜め方向へ流れる（左→右へ単調に下降する）
 *   - ループ / 渦 / 円環 / 結び目形状を作らない
 *   - 互いに交差させない（激しい交差の禁止を、交差ゼロで満たす）
 *
 * いずれの path も y が単調増加する2つの三次ベジエだけで構成し、
 * 制御点も進行方向の前方にしか置かない（折り返しを作らない）。
 * さらに3本のyの値域を重ならないよう分離してあるため、
 * どのxで切っても 主線 < 副線2 < 副線1 の順序が保たれ、交差は起こり得ない。
 *   主線  y 118→268 / 副線2 y 260→430 / 副線1 y 420→580
 *
 * 画面外(-24 / VIEW_W+24)から出入りさせ、線の端が画面内で切れないようにする。
 */
/** 主線: 最も太く、最も視認性が高い。ORB_X/ORB_Y を通過点として持つ。 */
const MAIN_PATH = `M -24 118 C 48 120, 104 166, ${ORB_X} ${ORB_Y} C 232 217, 292 246, 414 268`;

/** 副線1: 主線より細く、中程度のopacity。「条件を追加する」下の空き帯を通る。 */
const SUB_PATH_1 = "M -24 420 C 60 428, 126 468, 190 490 C 262 515, 336 552, 414 580";

/** 副線2: 最も細く、最も低いopacity。チップ群のpillの隙間を縫って奥行きだけを担う。 */
const SUB_PATH_2 = "M -24 260 C 56 266, 116 306, 180 330 C 252 357, 330 398, 414 430";

export function HomeBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      {/*
        地 + 大気。
        1層目: 上方から差す光（本文カラムを持ち上げる面の光）
        2層目: brass のごく薄い暖かみ（7%）。光源の色を地に一滴だけ落とす
        3層目: 下部に Moss Charcoal。青一色にせず、Surfaceの色相と地を繋ぐ
        4層目: 地そのもの
        fallbackはいずれも既存Tokenで、:has()非対応環境では従来のDark Forest表示になる。
      */}
      <div
        className="absolute inset-0"
        style={{
          background: [
            "radial-gradient(122% 46% at 50% -8%, var(--home-ground-lit, var(--kt-color-surface-elevated)) 0%, transparent 66%)",
            "radial-gradient(56% 22% at 50% 0%, color-mix(in oklab, var(--home-path, var(--kt-color-action-primary)) 7%, transparent) 0%, transparent 74%)",
            "radial-gradient(150% 52% at 50% 106%, color-mix(in oklab, var(--home-ground-moss, var(--kt-color-surface-default)) 58%, transparent) 0%, transparent 72%)",
            "var(--home-ground, var(--kt-color-background-base))",
          ].join(", "),
        }}
      />

      {/* 参道の波線。帯の高さを実寸で固定し、横方向にだけ伸ばす。 */}
      <svg
        className="absolute inset-x-0"
        style={{ top: `${BAND_TOP}px`, height: `${BAND_HEIGHT}px`, width: "100%" }}
        viewBox={`0 0 ${VIEW_W} ${BAND_HEIGHT}`}
        preserveAspectRatio="none"
        fill="none"
        focusable="false"
        aria-hidden
      >
        <defs>
          {/*
            主線の発光は「一部だけ」。Orbのx位置(42%)へ向かって brass から
            champagne gold へ明度が上がり、その前後で静かに落ちる。
            線全体を均一に光らせない。
          */}
          <linearGradient id="home-path-main" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.05" />
            <stop offset="24%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.18" />
            <stop offset="38%" stopColor="var(--home-path-lit, var(--kt-color-premium-accent))" stopOpacity="0.62" />
            <stop offset="44%" stopColor="var(--home-path-lit, var(--kt-color-premium-accent))" stopOpacity="0.8" />
            <stop offset="54%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.26" />
            <stop offset="72%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.04" />
          </linearGradient>

          {/* 副線1: 中程度。主線より暗く、均一な明るさにしない。 */}
          <linearGradient id="home-path-sub-1" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.04" />
            <stop offset="46%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.06" />
          </linearGradient>

          {/* 副線2: 最も低いopacity。文字の上を通る唯一の線なので、
              輪郭を主張させず奥行きだけを担う強さに抑える。 */}
          <linearGradient id="home-path-sub-2" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.02" />
            <stop offset="52%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.1" />
            <stop offset="100%" stopColor="var(--home-path, var(--kt-color-action-primary))" stopOpacity="0.03" />
          </linearGradient>
        </defs>

        {/* 描画順で階層を作る: 最も弱い副線2 → 副線1 → 主線 */}
        <path
          d={SUB_PATH_2}
          stroke="url(#home-path-sub-2)"
          strokeWidth="0.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={SUB_PATH_1}
          stroke="url(#home-path-sub-1)"
          strokeWidth="1"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={MAIN_PATH}
          stroke="url(#home-path-main)"
          strokeWidth="1.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {/*
        Main Orb（1個）。
        「光の玉」という物体ではなく、主線の途中に光が宿っているように見せる。

        SVGのfilterではなくCSSのradial-gradientで描く。SVGは横方向へ
        非等比に伸びるため、内部でぼかすと光が横に潰れる。実寸のdivで置けば
        どの幅でも正円のまま、主線上の同じ点に乗る。

        中心はやや不透明な champagne、外へ向かって brass が溶けて消える。
        Neon / 強い白光 / レンズフレアにしないため、白は一切混ぜず
        最大opacityも抑える。上端は入力カード、下端はチップ群に隠れるため、
        実際に見えるのはカード下端とチップ見出しの間に滲む暖かい光だけになる。
      */}
      <div
        className="absolute"
        style={{
          left: `${(ORB_X / VIEW_W) * 100}%`,
          top: `${BAND_TOP + ORB_Y}px`,
          width: "184px",
          height: "184px",
          transform: "translate(-50%, -50%)",
          background: [
            "radial-gradient(closest-side, color-mix(in oklab, var(--home-path-lit, var(--kt-color-premium-accent)) 40%, transparent) 0%, color-mix(in oklab, var(--home-path, var(--kt-color-action-primary)) 20%, transparent) 34%, color-mix(in oklab, var(--home-path, var(--kt-color-action-primary)) 6%, transparent) 62%, transparent 100%)",
          ].join(", "),
        }}
      />
    </div>
  );
}
