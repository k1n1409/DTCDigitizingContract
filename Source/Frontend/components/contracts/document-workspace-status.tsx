"use client";

import type { ReactNode } from "react";
import { CheckCircle2, CircleDashed, Loader2, AlertCircle, LockKeyhole } from "lucide-react";

export function DocumentWorkspaceStatus({ state, children }: { state: "saved" | "saving" | "unsaved" | "error" | "readonly"; children: ReactNode }) {
  const Icon = state === "saving" ? Loader2 : state === "saved" ? CheckCircle2 : state === "error" ? AlertCircle : state === "readonly" ? LockKeyhole : CircleDashed;
  return <div role="status" aria-live="polite" aria-atomic="true" className={`flex min-h-11 shrink-0 items-center gap-3 border-b px-4 py-2 text-sm ${state === "error" ? "bg-destructive/5 text-destructive" : state === "unsaved" ? "bg-amber-50 text-amber-950 dark:bg-amber-950/30 dark:text-amber-200" : "bg-card text-muted-foreground"}`}>
    <Icon aria-hidden className={`size-4 shrink-0 ${state === "saving" ? "animate-spin" : state === "saved" ? "text-emerald-600" : ""}`} />
    <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
  </div>;
}
