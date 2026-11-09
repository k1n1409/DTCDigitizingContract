"use client";
import { useState } from "react";
import Link from "next/link";
import { FileText, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import axiosClient from "@/lib/axios-interceptor";
import { getBlobApiErrorMessage } from "@/lib/api-error";
import { toast } from "@/components/ui/sonner";

export function ContractEditorSource({ contractId, title, revision, documentId }: { contractId: number; title: string; revision: number; documentId?: string }) {
  const [busy, setBusy] = useState(false);
  const open = async (format: "pdf" | "docx") => {
    const popup = format === "pdf" ? window.open("about:blank", "_blank") : null;
    if (format === "pdf" && !popup) { toast.error("Cho phép mở tab mới để xem tài liệu."); return; }
    if (popup) popup.opener = null;
    setBusy(true);
    try {
      const data = await axiosClient.get<unknown, Blob>(`/api/contracts/${contractId}/editor-source/${format}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      if (popup && !popup.closed) popup.location.replace(url);
      else if (format === "docx") { const link = document.createElement("a"); link.href = url; link.download = `contract-${contractId}-source.docx`; link.click(); }
      setTimeout(() => URL.revokeObjectURL(url), 300000);
    } catch (error) { popup?.close(); toast.error(await getBlobApiErrorMessage(error, "Không mở được tài liệu nguồn.")); }
    finally { setBusy(false); }
  };
  return <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/30 bg-primary/5 p-4"><div><h2 className="flex items-center gap-2 font-semibold"><FileText className="size-4" />Tài liệu soạn thảo nguồn · {title}</h2><p className="mt-1 text-sm text-muted-foreground">Bản nguồn cố định v{revision} khi tạo Draft, giữ riêng để đối chiếu. Trạng thái tài liệu dùng duyệt/ký nằm ở mục “Tài liệu chính thức”. Khi cần thay bản đó, mở editor và chọn “Cập nhật tài liệu cho hợp đồng đã có”.</p></div><div className="flex flex-wrap gap-2">{documentId && <Button asChild variant="outline"><Link href={`/contract-editor?document=${encodeURIComponent(documentId)}`}>Mở bản soạn</Link></Button>}<Button variant="outline" disabled={busy} onClick={() => void open("pdf")}><Eye className="mr-2 size-4" />Xem tài liệu nguồn</Button><Button variant="outline" disabled={busy} onClick={() => void open("docx")}><Download className="mr-2 size-4" />Word nguồn</Button></div></section>;
}
