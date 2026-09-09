// HomeActionGrid の各宛先が「意図されたルート契約」に解決することを機械的に担保する。
//
// 背景: 当初 /goshuins を「参拝の記録」の宛先にしていたが、この経路は
// redirect("/") でHomeへ戻るだけの死んだルートだった。DOM上はリンクが
// 存在するためコンポーネントテストでは検出できない。ここでは実際の
// App Router のルートファイルまで解決し、
//   (a) ルートが存在すること
//   (b) 即座に "/" へ redirect する行き止まりでないこと
// を検証する。宛先を増やすときも同じ検証が自動で効く。
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = path.resolve(__dirname, "../../../../app");
const GRID_SOURCE = path.resolve(__dirname, "../HomeActionGrid.tsx");

/** HomeActionGrid のソースから href を実際に抽出する（テストへの二重定義を避ける）。 */
function extractHrefs(): string[] {
  const src = readFileSync(GRID_SOURCE, "utf8");
  return [...src.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
}

/** "/compass?ref=home" -> App Router 上の page ファイル。動的セグメントも解決する。 */
function resolveRouteFile(href: string): string | null {
  const pathname = href.split(/[?#]/)[0];
  const segments = pathname.split("/").filter(Boolean);

  let dir = APP_DIR;
  for (const seg of segments) {
    const literal = path.join(dir, seg);
    if (existsSync(literal)) {
      dir = literal;
      continue;
    }
    return null; // 動的セグメントを要求する宛先はHomeの静的な入口として扱わない
  }

  for (const ext of ["tsx", "ts"]) {
    const file = path.join(dir, `page.${ext}`);
    if (existsSync(file)) return file;
  }
  return null;
}

describe("HomeActionGrid のルート契約", () => {
  const hrefs = extractHrefs();

  it("宛先を1つ以上持つ（抽出そのものが壊れていないことの保証）", () => {
    expect(hrefs.length).toBeGreaterThan(0);
  });

  it.each(hrefs)("%s は実在するpageルートに解決する", (href) => {
    expect(resolveRouteFile(href)).not.toBeNull();
  });

  it.each(hrefs)("%s は Home へ戻るだけの行き止まりではない", (href) => {
    const file = resolveRouteFile(href);
    expect(file).not.toBeNull();
    const source = readFileSync(file as string, "utf8");
    // 例: src/app/goshuins/page.tsx の redirect("/")
    expect(source).not.toMatch(/redirect\(\s*["'`]\/["'`]\s*\)/);
  });

  // 回帰防止: この検証が本当に死んだルートを弾けることを、実在する
  // 行き止まり(/goshuins)で確認する。将来 /goshuins が実装されたら
  // このテストが落ちるので、そのとき宛先として採用できる合図になる。
  it("検証ロジック自体が死んだルート(/goshuins)を検出できる", () => {
    const file = resolveRouteFile("/goshuins");
    expect(file).not.toBeNull();
    expect(readFileSync(file as string, "utf8")).toMatch(/redirect\(\s*["'`]\/["'`]\s*\)/);
  });
});
