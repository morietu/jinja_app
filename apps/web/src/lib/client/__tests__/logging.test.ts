import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/client/logging clientLog", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("debug/info は DEBUG_LOG が false のとき出力しない", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEBUG_LOG", "0");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mod = await import("@/lib/client/logging");

    mod.clientLog("debug", "EVT", { a: 1 });
    mod.clientLog("info", "EVT", { a: 1 });

    expect(logSpy).not.toHaveBeenCalled();
  });

  it("warn/error は DEBUG_LOG が false でも出力する", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEBUG_LOG", "0");

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mod = await import("@/lib/client/logging");

    mod.clientLog("warn", "EVT", { a: 1 });
    mod.clientLog("error", "EVT", { a: 1 });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalledTimes(1);
  });

  it("DEBUG_LOG が true のとき debug/info も出力する", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_DEBUG_LOG", "1");

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const mod = await import("@/lib/client/logging");

    mod.clientLog("debug", "EVT", { a: 1 });
    mod.clientLog("info", "EVT", { a: 1 });

    expect(logSpy).toHaveBeenCalledTimes(2);
  });
});
