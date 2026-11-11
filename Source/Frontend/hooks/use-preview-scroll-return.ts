"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/** Keep a transient viewport checkpoint while a preview covers or replaces it. */
export function usePreviewScrollReturn<T extends HTMLElement>(previewOpen: boolean, scope: string | number | undefined) {
  const viewportRef = useRef<T>(null);
  const checkpoint = useRef<{ scope: typeof scope; top: number; left: number } | null>(null);

  const capture = useCallback(() => {
    const viewport = viewportRef.current;
    checkpoint.current = viewport ? { scope, top: viewport.scrollTop, left: viewport.scrollLeft } : null;
  }, [scope]);

  const clear = useCallback(() => { checkpoint.current = null; }, []);

  useLayoutEffect(() => {
    const position = checkpoint.current;
    if (!position) return;
    if (position.scope !== scope) {
      clear();
      return;
    }
    if (previewOpen) return;
    clear();
    viewportRef.current?.scrollTo({ top: position.top, left: position.left, behavior: "instant" });
  }, [clear, previewOpen, scope]);

  return { viewportRef, capture, clear };
}
