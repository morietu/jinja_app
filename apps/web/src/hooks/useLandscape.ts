"use client";

import { useEffect, useState } from "react";

/**
 * モバイル端末の「横向き」のときだけ true を返す。
 * PC やタブレットなど、幅が大きい画面では常に false。
 */
function useMobileLandscape(maxWidth = 768) {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    function update() {
      if (typeof window === "undefined") return;

      const { innerWidth, innerHeight } = window;
      const landscape = innerWidth > innerHeight;
      const isMobileWidth = innerWidth <= maxWidth;

      setIsLandscape(landscape && isMobileWidth);
    }

    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, [maxWidth]);

  return isLandscape;
}

/**
 * 既存の import を壊さないためのラッパー。
 * これを使っている側（ConciergeLayout など）はそのままでOK。
 */
export function useLandscape() {
  return useMobileLandscape();
}
