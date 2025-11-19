// apps/web/src/hooks/useLandscape.ts
import { useEffect, useState } from "react";

/**
 * 画面が横向きかどうかを返すフック
 * true: 横向き（width > height）
 */
export function useLandscape(): boolean {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    // SSR 回避
    if (typeof window === "undefined") return;

    const handleResize = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    handleResize(); // 初期判定
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return isLandscape;
}
