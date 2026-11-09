"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoundedSelect } from "@/components/ui/custom/rounded-select";
import { DEFAULT_DOCUMENT_LAYOUT, type ContractDocumentLayout } from "@/lib/contract-rich-text";

export function DocumentLayoutDialog({ open, onClose, value, preserved, onApply }: { open: boolean; onClose: () => void; value?: ContractDocumentLayout; preserved: boolean; onApply: (value?: ContractDocumentLayout) => void }) {
  const [layout, setLayout] = useState<ContractDocumentLayout>(value || DEFAULT_DOCUMENT_LAYOUT);
  const [error, setError] = useState("");
  const setNumber = (key: keyof ContractDocumentLayout, value: string) => setLayout(current => ({ ...current, [key]: value === "" ? NaN : Number(value) }));
  return <Dialog open={open} onOpenChange={v => !v && onClose()}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Bố cục trang</DialogTitle><DialogDescription>Áp dụng toàn tài liệu. Ngắt trang từng đoạn bằng nút “Ngắt trang” trên thanh soạn thảo.</DialogDescription></DialogHeader>
    {preserved && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{value ? "Đang dùng bố cục tùy chỉnh." : "Hiện giữ nguyên khổ/lề từ Word gốc."} Áp dụng sẽ đổi khổ/lề của tất cả section; ảnh, header/footer và khối chỉ xem vẫn giữ nội dung. Giãn dòng/khoảng cách chỉ áp dụng vùng chỉnh được.</p>}
    <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Khổ giấy</Label><RoundedSelect value={layout.paper} onValueChange={v => setLayout(l => ({ ...l, paper: v as "A4" | "A5" }))} options={[{ value: "A4", label: "A4 · 210 × 297 mm" }, { value: "A5", label: "A5 · 148 × 210 mm" }]} /></div><div className="space-y-2"><Label>Hướng trang</Label><RoundedSelect value={layout.orientation} onValueChange={v => setLayout(l => ({ ...l, orientation: v as "portrait" | "landscape" }))} options={[{ value: "portrait", label: "Trang dọc" }, { value: "landscape", label: "Trang ngang" }]} /></div>
    {([['marginTop', 'Lề trên (mm)'], ['marginBottom', 'Lề dưới (mm)'], ['marginLeft', 'Lề trái (mm)'], ['marginRight', 'Lề phải (mm)'], ['lineSpacing', 'Giãn dòng (1–3)'], ['spaceBefore', 'Trước đoạn (pt)'], ['spaceAfter', 'Sau đoạn (pt)']] as const).map(([key, label]) => <div className="space-y-2" key={key}><Label htmlFor={`layout-${key}`}>{label}</Label><Input id={`layout-${key}`} type="number" showControls={false} min={key.startsWith("margin") ? 5 : key === "lineSpacing" ? 1 : 0} max={key.startsWith("margin") ? 50 : key === "lineSpacing" ? 3 : 72} step={key === "lineSpacing" ? 0.05 : 0.5} value={Number.isNaN(layout[key]) ? "" : layout[key]} onChange={e => setNumber(key, e.target.value)} /></div>)}</div>
    <p className="text-sm text-muted-foreground">Trang HTML là bản hỗ trợ soạn thảo; dùng PDF thực tế để xác nhận số trang và ngắt trang cuối cùng. {!preserved && "Tài liệu soạn mới có đầu/chân trang công ty: cần lề trên tối thiểu 20 mm, lề dưới 12 mm."}</p>{error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex flex-wrap justify-end gap-2">{preserved && <Button variant="outline" onClick={() => onApply(undefined)}>Giữ bố cục Word gốc</Button>}<Button variant="outline" onClick={onClose}>Hủy</Button><Button onClick={() => { if (Object.entries(layout).some(([k, v]) => !["paper", "orientation"].includes(k) && (!Number.isFinite(v) || Number(v) < (k.startsWith("margin") ? 5 : k === "lineSpacing" ? 1 : 0) || Number(v) > (k.startsWith("margin") ? 50 : k === "lineSpacing" ? 3 : 72)))) { setError("Lề 5–50 mm, giãn dòng 1–3, khoảng cách đoạn 0–72 pt."); return; } if (!preserved && (layout.marginTop < 20 || layout.marginBottom < 12)) { setError("Để đầu/chân trang không chồng vào nội dung, cần lề trên tối thiểu 20 mm và lề dưới 12 mm."); return; } onApply(layout); }}>Áp dụng bố cục</Button></div>
  </DialogContent></Dialog>;
}
