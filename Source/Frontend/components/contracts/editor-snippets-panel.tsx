"use client";
import { useEffect, useState } from "react";
import { GripVertical, Plus, Search, X, Layers3 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CONTRACT_SNIPPETS, CONTRACT_SNIPPET_MIME, linkedSnippetContent } from "@/lib/contract-editor-snippets";
import { editorProviderValues } from "@/services/editor-provider-api";
import { getApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/components/ui/sonner";

export function EditorSnippetsPanel({ bindings, disabled, onInsert, onBindingsChange }: { bindings: Record<string, string>; disabled: boolean; onInsert: (content: string) => void; onBindingsChange: (values: Record<string, string>) => void }) {
  const [values, setValues] = useState<Record<string, string>>({}); const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const searchable = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi-VN").replace(/đ/g, "d");
  const snippets = CONTRACT_SNIPPETS.filter(snippet => searchable(`${snippet.title} ${snippet.description} ${snippet.fields.map(field => field.label).join(" ")}`).includes(searchable(query.trim())));
  const [provider, setProvider] = useState<Record<string, string>>({});
  const [providerBusy, setProviderBusy] = useState(true), [providerError, setProviderError] = useState(""), [reloadProvider, setReloadProvider] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void editorProviderValues().then(result => { if (!cancelled) { setProvider(result); setProviderError(""); } }).catch(error => { if (!cancelled) setProviderError(getApiErrorMessage(error, "Không tải được hồ sơ pháp lý công ty.")); }).finally(() => { if (!cancelled) setProviderBusy(false); });
    return () => { cancelled = true; };
  }, [reloadProvider]);
  const active = CONTRACT_SNIPPETS.find(s => s.id === selected);
  const data = { ...bindings, ...values };
  for (const [key, value] of Object.entries(provider)) if (!(key in values) && !data[key]?.trim()) data[key] = value;
  const contentFor = (id: string) => linkedSnippetContent(id, id === "provider" ? data : undefined);
  const applyValues = (id: string) => {
    const fields = CONTRACT_SNIPPETS.find(s => s.id === id)?.fields || [];
    const defaults = id === "provider" ? Object.fromEntries(Object.entries(provider).filter(([key]) => !bindings[key]?.trim())) : {};
    const patch = { ...defaults, ...Object.fromEntries(fields.filter(f => Object.hasOwn(values, f.key)).map(f => [f.key, values[f.key]])) };
    if (Object.keys(patch).length) onBindingsChange(patch);
    setValues({});
  };
  return <aside aria-label="Cụm nội dung hợp đồng" className="document-workspace-ui w-full shrink-0 space-y-3 border-l bg-card p-4 lg:w-[270px] xl:w-[288px] lg:overflow-y-auto">
    <div className="sticky -top-4 z-10 -mx-4 space-y-3 border-b bg-card px-4 pb-4 pt-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><Layers3 className="size-5 text-primary" />Cụm nội dung soạn nhanh</h2><p className="text-xs leading-relaxed text-muted-foreground">Kéo một cụm vào tài liệu, hoặc đặt con trỏ rồi bấm Chèn. Có thể điền thông tin trước hoặc sau; cần rà soát nội dung trước khi sử dụng.</p><div className="relative"><Search aria-hidden className="pointer-events-none absolute left-3 top-3.5 size-4 text-primary" /><Input aria-label="Tìm cụm nội dung" placeholder="Tìm cụm nội dung..." showControls={false} maxLength={100} value={query} onChange={e => setQuery(e.target.value)} className="h-11 rounded-xl border-primary/30 bg-background pl-9 pr-10" />{query && <button type="button" aria-label="Xóa tìm kiếm cụm nội dung" className="absolute right-2 top-2 rounded-lg p-1.5 hover:bg-muted" onClick={() => setQuery("")}><X className="size-4" /></button>}</div></div>
    {!snippets.length && <div className="rounded-2xl border border-dashed p-5 text-center"><p>Không tìm thấy cụm phù hợp.</p><Button variant="link" onClick={() => setQuery("")}>Xem tất cả cụm</Button></div>}
    {snippets.map(snippet => <div key={snippet.id} draggable={!disabled && !(snippet.id === "provider" && providerBusy)} onDragStart={e => { if (disabled || (snippet.id === "provider" && providerBusy)) { e.preventDefault(); return; } e.dataTransfer.setData(CONTRACT_SNIPPET_MIME, contentFor(snippet.id)); e.dataTransfer.effectAllowed = "copy"; applyValues(snippet.id); }} className={`space-y-3 rounded-2xl border bg-background p-4 transition-shadow ${disabled ? "opacity-50" : "cursor-grab hover:border-primary/50 hover:shadow-md active:cursor-grabbing"}`}>
      <div className="flex items-start gap-2"><GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><h3 className="text-xs font-semibold">{snippet.title}</h3><p className="mt-1 text-[11px] text-muted-foreground">{snippet.description}</p></div></div>
      {snippet.id === "provider" && <div className="space-y-2 text-xs text-muted-foreground">{providerBusy ? <p>Đang lấy hồ sơ pháp lý...</p> : providerError ? <><p role="alert">{providerError}</p><Button size="sm" variant="ghost" disabled={disabled} onClick={() => { setProviderBusy(true); setReloadProvider(n => n + 1); }}>Tải lại hồ sơ</Button></> : <><p className="font-medium text-foreground">{provider.PROVIDER_NAME || "Chưa có tên công ty"}</p><Button size="sm" variant="outline" disabled={disabled} onClick={() => { onBindingsChange(provider); toast.success("Đã áp dụng hồ sơ pháp lý công ty vào các trường Bên B đang liên kết. Không sửa hồ sơ nguồn."); }}>Dùng hồ sơ pháp lý</Button></>}</div>}
      <div className="flex flex-wrap gap-1"><Button size="sm" variant="outline" disabled={disabled || (snippet.id === "provider" && providerBusy)} onClick={() => { setValues({}); setSelected(snippet.id); }}>Điền thông tin</Button><Button size="sm" variant="ghost" disabled={disabled || (snippet.id === "provider" && providerBusy)} onClick={() => { applyValues(snippet.id); onInsert(contentFor(snippet.id)); }}><Plus className="mr-1 size-3" />Chèn</Button></div>
    </div>)}
    <Dialog open={!!active} onOpenChange={open => { if (!open) { setValues({}); setSelected(""); } }}><DialogContent className="max-h-[85vh] overflow-y-auto"><DialogHeader><DialogTitle>{active?.title}</DialogTitle><DialogDescription>Thông tin còn trống hiện thành nhãn dễ hiểu để bấm điền sau. Các vị trí cùng thông tin sẽ cập nhật cùng nhau, không ghi đè danh mục khách hàng.</DialogDescription></DialogHeader>{active?.fields.map(field => <div key={field.key} className="space-y-1"><Label htmlFor={`snippet-${field.key}`}>{field.label}</Label><Textarea id={`snippet-${field.key}`} maxLength={2000} rows={2} value={data[field.key] || ""} onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))} /></div>)}<Button disabled={disabled} onClick={() => { if (active) { applyValues(active.id); onInsert(contentFor(active.id)); } setSelected(""); }}>Chèn tại con trỏ</Button></DialogContent></Dialog>
  </aside>;
}
