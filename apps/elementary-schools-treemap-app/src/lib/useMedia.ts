import { useEffect, useState } from "react";

// 大螢幕「塞滿視窗、不出捲軸」模式的門檻；不滿足（小裝置/矮視窗）退回正常捲動版面
export const FIT_QUERY = "(min-width: 1000px) and (min-height: 640px)";

export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    setMatches(mq.matches);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}
