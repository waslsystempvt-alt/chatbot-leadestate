import { useEffect, useState } from "react";

function isHostMobileViewport(): boolean {
  try {
    const ua = navigator?.userAgent || "";
    const uaMobile = /Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Mobile/i.test(ua);
    const touchLikely =
      typeof navigator?.maxTouchPoints === "number" ? navigator.maxTouchPoints > 0 : false;
    const sw = screen?.width ?? 9999;
    const sh = screen?.height ?? 9999;
    const shortSide = Math.min(sw, sh);
    const longSide = Math.max(sw, sh);
    const screenLikely = shortSide <= 640 && longSide <= 1100;
    const touchHandheldLikely = touchLikely && shortSide <= 820 && longSide <= 1280;
    return !!uaMobile || screenLikely || touchHandheldLikely;
  } catch {
    return false;
  }
}

export function useMobileLayout(embedded: boolean): boolean {
  const [mobile, setMobile] = useState(() => {
    if (embedded) return isHostMobileViewport();
    return typeof window !== "undefined" && window.innerWidth <= 640;
  });

  useEffect(() => {
    const sync = () => {
      if (embedded) {
        setMobile(isHostMobileViewport());
      } else {
        setMobile(window.innerWidth <= 640);
      }
    };
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [embedded]);

  return mobile;
}
