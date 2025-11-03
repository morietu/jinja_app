// apps/web/vitest.setup.ts
import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// next/navigation の最低限モック
const _replace = vi.fn();
const _push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: _replace, push: _push }),
  useSearchParams: () => new URLSearchParams(),
  _mocks: { replace: _replace, push: _push },
}));

// 認証フックのデフォルトモック（各テストで _setAuth で上書き可）
vi.mock("@/lib/hooks/useAuth", () => {
  let state = {
    user: null,
    isLoggedIn: false,
    loading: false,
    logout: vi.fn(),
  };
  return {
    __esModule: true,
    useAuth: () => state,
    _setAuth: (next: Partial<typeof state>) => {
      state = { ...state, ...next };
    },
  };
});
