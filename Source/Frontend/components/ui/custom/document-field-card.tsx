"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** A compact field summary shared by source review and document authoring. */
export function DocumentFieldCard({ id, title, subtitle, status, expanded, onToggle, children, actions }: {
  id?: string; title: string; subtitle?: string; status: string;
  expanded: boolean; onToggle: () => void; children: ReactNode; actions?: ReactNode;
}) {
  const panelId = useId();
  return <article id={id} className={cn("min-w-0 scroll-mt-4 overflow-hidden rounded-xl border bg-card transition-colors", expanded && "border-primary/60 ring-1 ring-primary/10")}>
    <div className="flex items-start"><button type="button" aria-expanded={expanded} aria-controls={panelId} onClick={onToggle}
      className="flex w-full min-w-0 items-start gap-3 p-3 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
      <span className="min-w-0 flex-1 space-y-1">
        <span className="block break-words text-sm font-semibold [overflow-wrap:anywhere]">{title}</span>
        <span className="block text-xs text-primary">{status}</span>
        {subtitle && <span className="line-clamp-2 block break-words text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      <ChevronDown aria-hidden className={cn("mt-1 size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
    </button>{actions && <div className="shrink-0 py-2 pr-2">{actions}</div>}</div>
    {expanded && <div id={panelId} className="space-y-3 border-t bg-muted/15 p-3">{children}</div>}
  </article>;
}

export function DocumentFieldValue({ id, value, onChange, maxLength = 10000, singleLine = false, disabled = false }: {
  id: string; value: string; onChange: (value: string) => void;
  maxLength?: number; singleLine?: boolean; disabled?: boolean;
}) {
  return <div className="min-w-0 space-y-1">
    <Textarea id={id} value={value} maxLength={maxLength} disabled={disabled}
      rows={4} className="max-h-64 min-h-28 resize-y bg-background text-sm [field-sizing:fixed]"
      onKeyDown={e => { if (singleLine && e.key === "Enter" && !e.nativeEvent.isComposing) e.preventDefault(); }}
      onChange={e => onChange(singleLine ? e.target.value.replace(/[\r\n\t]+/g, " ") : e.target.value)} />
    <div className="flex items-start justify-between gap-3 text-[11px] text-muted-foreground">
      <span>{singleLine ? "Tự ngắt dòng để đọc; dữ liệu lưu trên một dòng." : "Có thể kéo góc dưới để mở rộng."}</span>
      <span className="shrink-0 tabular-nums">{value.length.toLocaleString("vi-VN")}/{maxLength.toLocaleString("vi-VN")}</span>
    </div>
  </div>;
}
