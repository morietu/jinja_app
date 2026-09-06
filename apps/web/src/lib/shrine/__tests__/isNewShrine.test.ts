import { describe, expect, it } from "vitest";

import { NEW_SHRINE_BADGE_DAYS, isNewShrine } from "@/lib/shrine/isNewShrine";

// JST(UTC+9)の指定日時をDateへ変換するヘルパー。
function jst(isoWithoutZone: string): Date {
  return new Date(`${isoWithoutZone}+09:00`);
}

describe("isNewShrine", () => {
  it("表示期間は追加日を1日目として14日間である", () => {
    expect(NEW_SHRINE_BADGE_DAYS).toBe(14);
  });

  it("追加当日はtrue", () => {
    expect(isNewShrine(jst("2026-09-01T10:00:00").toISOString(), jst("2026-09-01T23:00:00"))).toBe(true);
  });

  it("14日間の表示最終日（13日差）はtrue", () => {
    // 2026-09-01追加 → 9/1〜9/14が新着
    expect(isNewShrine(jst("2026-09-01T00:30:00").toISOString(), jst("2026-09-14T23:59:00"))).toBe(true);
  });

  it("15日目（14日差）はfalse", () => {
    expect(isNewShrine(jst("2026-09-01T23:30:00").toISOString(), jst("2026-09-15T00:00:00"))).toBe(false);
  });

  it("15日目より後もfalse", () => {
    expect(isNewShrine(jst("2026-09-01T12:00:00").toISOString(), jst("2026-10-01T12:00:00"))).toBe(false);
  });

  it("日単位判定であり、時分秒による24時間換算はしない", () => {
    // JSTで9/1 23:59追加 → 9/2 00:01時点は経過1分だが、日付差1日なので新着のまま。
    expect(isNewShrine(jst("2026-09-01T23:59:00").toISOString(), jst("2026-09-02T00:01:00"))).toBe(true);

    // 同じ組み合わせでも、13日差の最終日を跨いだ瞬間に非表示になる。
    expect(isNewShrine(jst("2026-09-01T23:59:00").toISOString(), jst("2026-09-15T00:01:00"))).toBe(false);
  });

  describe("UTCではなくAsia/Tokyoの日付として判定する", () => {
    it("UTC日付では前日でも、JST日付が同一なら追加当日として扱う", () => {
      // 2026-09-01T00:30+09:00 === 2026-08-31T15:30Z（UTC日付は8/31、JST日付は9/1）
      const createdAt = "2026-08-31T15:30:00Z";
      // 2026-09-14T21:00+09:00 === 2026-09-14T12:00Z
      // UTC日付差なら14日だが、JST日付差は13日なので新着。
      expect(isNewShrine(createdAt, new Date("2026-09-14T12:00:00Z"))).toBe(true);
    });

    it("UTC日付では同日でも、JST日付が翌日なら1日進んだものとして扱う", () => {
      // 2026-09-14T16:00Z === 2026-09-15T01:00+09:00（UTC日付は9/14、JST日付は9/15）
      // JST日付差14日 → 非表示。
      expect(isNewShrine("2026-08-31T15:30:00Z", new Date("2026-09-14T16:00:00Z"))).toBe(false);
    });
  });

  describe("fail safe", () => {
    it("undefinedはfalse", () => {
      expect(isNewShrine(undefined, jst("2026-09-01T12:00:00"))).toBe(false);
    });

    it("nullはfalse", () => {
      expect(isNewShrine(null, jst("2026-09-01T12:00:00"))).toBe(false);
    });

    it("空文字・空白のみはfalse", () => {
      expect(isNewShrine("", jst("2026-09-01T12:00:00"))).toBe(false);
      expect(isNewShrine("   ", jst("2026-09-01T12:00:00"))).toBe(false);
    });

    it("不正な日時文字列はfalse（例外を投げない）", () => {
      expect(() => isNewShrine("not-a-date", jst("2026-09-01T12:00:00"))).not.toThrow();
      expect(isNewShrine("not-a-date", jst("2026-09-01T12:00:00"))).toBe(false);
      expect(isNewShrine("2026-13-45T99:99:99Z", jst("2026-09-01T12:00:00"))).toBe(false);
    });

    it("nowが不正なDateでもfalse", () => {
      expect(isNewShrine(jst("2026-09-01T12:00:00").toISOString(), new Date("invalid"))).toBe(false);
    });

    it("created_atが未来日付はfalse（0〜13日差のみ新着）", () => {
      expect(isNewShrine(jst("2026-09-02T00:00:00").toISOString(), jst("2026-09-01T12:00:00"))).toBe(false);
    });
  });

  it("nowを省略しても例外にならない", () => {
    expect(() => isNewShrine(new Date().toISOString())).not.toThrow();
    expect(isNewShrine(new Date().toISOString())).toBe(true);
  });
});
