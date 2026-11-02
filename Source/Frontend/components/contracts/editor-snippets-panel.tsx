"use client";
import { useState } from "react";
import { GripVertical, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CONTRACT_SNIPPETS, CONTRACT_SNIPPET_MIME, linkedSnippetContent } from "@/lib/contract-editor-snippets";

export function EditorSnippetsPanel({ bindings, disabled, onInsert, onBindingsChange }: { bindings: Record<string, string>; disabled: boolean; onInsert: (content: string) => void; onBindingsChange: (values: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>({}); const [selected, setSelected] = useState("");
  const active = CONTRACT_SNIPPETS.find(s => s.id === selected);
  const data = { ...bindings, ...values };
  const applyValues = (id: string) => {
    const fields = CONTRACT_SNIPPETS.find(s => s.id === id)?.fields || [];
    const patch = Object.fromEntries(fields.filter(f => Object.hasOwn(values, f.key)).map(f => [f.key, values[f.key]]));
    if (Object.keys(patch).length) onBindingsChange(patch);
    setValues({});
  };
  return <aside aria-label="Cụm nội dung hợp đồng" className="document-workspace-ui w-full shrink-0 space-y-3 border-l bg-card p-4 lg:w-[300px] xl:w-[320px] lg:overflow-y-auto">
    <h2 className="text-sm font-semibold">Cụm nội dung soạn nhanh</h2><p className="text-xs leading-relaxed text-muted-foreground">Điền thông tin, kéo cụm vào vị trí trong tài liệu hoặc bấm Chèn tại con trỏ. Khung tham khảo cần được rà soát nghiệp vụ; không tự tạo hiệu lực pháp lý.</p>
    {CONTRACT_SNIPPETS.map(snippet => <div key={snippet.id} draggable={!disabled} onDragStart={e => { if (disabled) { e.preventDefault(); return; } e.dataTransfer.setData(CONTRACT_SNIPPET_MIME, linkedSnippetContent(snippet.id)); e.dataTransfer.effectAllowed = "copy"; applyValues(snippet.id); }} className={`space-y-2 rounded-xl border bg-background p-3 ${disabled ? "opacity-50" : "cursor-grab hover:border-primary/50 active:cursor-grabbing"}`}>
      <div className="flex items-start gap-2"><GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><h3 className="text-xs font-semibold">{snippet.title}</h3><p className="mt-1 text-[11px] text-muted-foreground">{snippet.description}</p></div></div>
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled} onClick={() => { setValues({}); setSelected(snippet.id); }}>Điền thông tin</Button><Button size="sm" variant="ghost" disabled={disabled} onClick={() => { applyValues(snippet.id); onInsert(linkedSnippetContent(snippet.id)); }}><Plus className="mr-1 size-3" />Chèn</Button></div>
    </div>)}
    <Dialog open={!!active} onOpenChange={open => !open && setSelected("")}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{active?.title}</DialogTitle><DialogDescription>Thông tin còn trống hiện thành nhãn dễ hiểu để bấm điền sau. Các vị trí cùng thông tin sẽ cập nhật cùng nhau, không ghi đè danh mục khách hàng.</DialogDescription></DialogHeader>{active?.fields.map(field => <div key={field.key} className="space-y-1"><Label htmlFor={`snippet-${field.key}`}>{field.label}</Label><Textarea id={`snippet-${field.key}`} maxLength={2000} rows={2} value={data[field.key] || ""} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} /></div>)}<Button disabled={disabled} onClick={() => { if (active) { applyValues(active.id); onInsert(linkedSnippetContent(active.id)); } setSelected(""); }}>Chèn tại con trỏ</Button></DialogContent></Dialog>
  </aside>;
}
