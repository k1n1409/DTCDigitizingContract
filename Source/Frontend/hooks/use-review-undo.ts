"use client";

import { useCallback, useRef, useState, type SetStateAction } from "react";

/** Local undo is independent of immutable server revisions, including after autosave. */
export function useReviewUndo<T>(onEdit: (value: boolean) => void) {
  const [fields, render] = useState<T[]>([]);
  const current = useRef<T[]>([]);
  const generation = useRef(0);
  const past = useRef<T[][]>([]);
  const future = useRef<T[][]>([]);
  const group = useRef({ key: "", at: 0 });
  const [counts, setCounts] = useState({ undo: 0, redo: 0 });
  const refresh = () => setCounts({ undo: past.current.length, redo: future.current.length });
  const reset = useCallback((value: T[]) => {
    current.current = value; past.current = []; future.current = [];
    group.current = { key: "", at: 0 }; generation.current++;
    render(value); setCounts({ undo: 0, redo: 0 });
  }, []);
  const update = useCallback((value: SetStateAction<T[]>, key = "") => {
    const previous = current.current;
    const next = typeof value === "function" ? value(previous) : value;
    if (JSON.stringify(previous) === JSON.stringify(next)) return;
    const now = Date.now();
    if (!key || group.current.key !== key || now - group.current.at > 700) {
      past.current = [...past.current.slice(-49), previous];
    }
    group.current = { key, at: now }; future.current = [];
    current.current = next; generation.current++; render(next); onEdit(true);
    setCounts({ undo: past.current.length, redo: 0 });
  }, [onEdit]);
  const travel = (redo: boolean) => {
    const from = redo ? future : past; const to = redo ? past : future;
    const next = from.current.at(-1); if (!next) return;
    from.current = from.current.slice(0, -1); to.current = [...to.current.slice(-49), current.current];
    current.current = next; generation.current++; group.current = { key: "", at: 0 };
    render(next); refresh(); onEdit(true);
  };
  return { fields, current, generation, update, reset, undo: () => travel(false), redo: () => travel(true), canUndo: counts.undo > 0, canRedo: counts.redo > 0 };
}
