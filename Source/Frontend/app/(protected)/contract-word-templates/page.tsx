"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FilePenLine, FileUp, LibraryBig, Settings2 } from "lucide-react";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { DocumentLibraryPanel } from "@/components/contracts/document-library-workspace";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/ui/custom/header";
import { usePermission } from "@/hooks/use-permission";
import { RBAC_PERMISSIONS as p } from "@/lib/rbac";

function WordTemplates() {
  const router = useRouter();
  const { can } = usePermission();
  return (
    <>
      <Header title="Mẫu hợp đồng Word" />
      <div className="min-h-0 grow overflow-y-auto px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl space-y-5">
          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <h1 className="flex items-center gap-3 text-2xl font-bold"><LibraryBig className="size-6 text-primary" aria-hidden /> Mẫu hợp đồng Word</h1>
            <p className="mt-2 text-sm text-muted-foreground">Bấm Dùng mẫu để mở bản sao, điền thông tin và kiểm tra tài liệu trước khi tạo hợp đồng nháp. Mẫu gốc không thay đổi.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild><Link href="/contract-import"><FileUp aria-hidden />Nhập Word làm mẫu</Link></Button>
              <Button variant="outline" asChild><Link href="/contract-editor"><FilePenLine aria-hidden />Soạn mẫu mới</Link></Button>
              {can(p.templateManage) && <Button variant="ghost" asChild><Link href="/admin/contract-templates"><Settings2 aria-hidden />Mẫu nâng cao (placeholder)</Link></Button>}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">Trong trang nhập Word hoặc soạn thảo, chọn <strong>Lưu thành mẫu</strong> sau khi rà soát dữ liệu riêng.</p>
          </section>
          <DocumentLibraryPanel templateOnly disabled={false} refreshKey="word-templates"
            onOpen={id => router.push(`/contract-import?document=${encodeURIComponent(id)}`)}
            onUseTemplate={id => router.push(`/contract-editor?template=${encodeURIComponent(id)}`)}
            onOpenEditor={id => router.push(`/contract-editor?document=${encodeURIComponent(id)}`)} />
        </div>
      </div>
    </>
  );
}

export default function WordTemplatesPage() {
  return <PermissionGuard permission={p.contractCreate}><WordTemplates /></PermissionGuard>;
}
