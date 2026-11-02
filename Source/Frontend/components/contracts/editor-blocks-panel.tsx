"use client";
import { useState } from "react";
import { ArrowDown, ArrowUp, GripVertical, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { parseContractRichText, serializeContractRichText } from "@/lib/contract-rich-text";

export function EditorBlocksPanel({ content, onChange }: { content: string; onChange: (value: string) => void }) {
  const blocks = parseContractRichText(content).blocks;
  const [removeIndex, setRemoveIndex] = useState<number | null>(null);
  const move = (from: number, to: number) => {
    if (!Number.isInteger(from) || from < 0 || from >= blocks.length || to < 0 || to >= blocks.length || from === to) return;
    const next = [...blocks]; const [block] = next.splice(from, 1); next.splice(to, 0, block);
    onChange(serializeContractRichText({ blocks: next }));
  };
  return <section className="document-workspace-ui space-y-2 border-t pt-4"><h2 className="font-semibold">Bố cục nội dung</h2><p className="text-xs text-muted-foreground">Kéo tay nắm để đổi thứ tự đoạn/bảng. Có thể dùng nút lên/xuống trên điện thoại hoặc bàn phím. Nội dung bên phải vẫn chỉnh trực tiếp được.</p>
    {blocks.map((block, index) => {
      const text = block.type === "paragraph" ? block.runs.map(r => r.text).join("") : `Bảng ${block.rows.length} dòng`;
      return <div key={index} className="rounded-lg border bg-background p-2" onDragOver={e => { if (e.dataTransfer.types.includes("application/x-contract-block")) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }} onDrop={e => { if (!e.dataTransfer.types.includes("application/x-contract-block")) return; e.preventDefault(); e.stopPropagation(); move(Number(e.dataTransfer.getData("application/x-contract-block")), index); }}>
        <div className="flex items-center gap-2"><button type="button" draggable className="cursor-grab rounded p-1 active:cursor-grabbing" aria-label={`Kéo ${block.type === "table" ? "bảng" : "đoạn"} ${index + 1}`} onDragStart={e => { e.dataTransfer.setData("application/x-contract-block", String(index)); e.dataTransfer.effectAllowed = "move"; }}><GripVertical className="size-4" /></button><p className="min-w-0 flex-1 truncate text-xs">{index + 1}. {text.trim() || "Đoạn trống"}</p></div>
        <div className="flex justify-end"><Button size="icon" variant="ghost" aria-label={`Đưa mục ${index + 1} lên`} disabled={index === 0} onClick={() => move(index, index - 1)}><ArrowUp className="size-3" /></Button><Button size="icon" variant="ghost" aria-label={`Đưa mục ${index + 1} xuống`} disabled={index === blocks.length - 1} onClick={() => move(index, index + 1)}><ArrowDown className="size-3" /></Button><Button size="icon" variant="ghost" aria-label={`Nhân đôi mục ${index + 1}`} onClick={() => { const next = [...blocks]; next.splice(index + 1, 0, structuredClone(block)); onChange(serializeContractRichText({ blocks: next })); }}><Copy className="size-3" /></Button><Button size="icon" variant="ghost" aria-label={`Xóa mục ${index + 1}`} onClick={() => setRemoveIndex(index)}><Trash2 className="size-3 text-destructive" /></Button></div>
      </div>;
    })}
    <ConfirmDialog isOpen={removeIndex !== null} onClose={() => setRemoveIndex(null)} title="Xóa đoạn hoặc bảng?" description="Nội dung mục này sẽ bị xóa khỏi tài liệu. Bạn có thể khôi phục phiên bản đã lưu qua lịch sử." confirmText="Xóa mục" variant="destructive" onConfirm={() => { if (removeIndex !== null) onChange(serializeContractRichText({ blocks: blocks.filter((_, i) => i !== removeIndex) })); setRemoveIndex(null); }} />
  </section>;
}
