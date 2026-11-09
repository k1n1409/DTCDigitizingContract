"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, FilePlus2, LayoutGrid, Search, UserRound } from "lucide-react";
import { Header } from "@/components/ui/custom/header";
import { navItems, type NavItem } from "@/components/sidebar";
import { useAuthStore } from "@/hooks/use-auth-store";
import { APP_NAME } from "@/lib/application-branding";
import { hasAnyPermission, RBAC_PERMISSIONS as p } from "@/lib/rbac";
import { ContractStatus } from "@/services/contract-api";

const readContracts = [p.contractReadOwn, p.contractReadTenant];
const signedContractsHref = `/contracts?status=${ContractStatus.Signed}`;
const extraTiles: NavItem[] = [
  { href: "/contracts/create", label: "Tạo hợp đồng nháp", icon: FilePlus2, requiredPermissions: [p.contractCreate] },
  { href: signedContractsHref, label: "Hợp đồng đã ký", icon: Search, requiredPermissions: readContracts },
  { href: "/dashboard/statistics", label: "Thống kê hợp đồng", icon: BarChart3, requiredPermissions: readContracts },
  { href: "/profile", label: "Tài khoản của tôi", icon: UserRound },
];
const tiles = new Map([...navItems, ...extraTiles].map(tile => [tile.href, tile]));
const groups = [
  { title: "Khởi tạo hợp đồng", color: "bg-[#005789]", paths: ["/contracts/create", "/contract-editor", "/contract-import"] },
  { title: "Quản lý hợp đồng", color: "bg-[#9a440c]", paths: ["/contracts", "/contract-approvals", "/quotations"] },
  { title: "Tra cứu và thống kê", color: "bg-[#176348]", paths: [signedContractsHref, "/dashboard/statistics", "/contract-audits"] },
  { title: "Danh mục", color: "bg-[#9d3156]", paths: ["/contract-word-templates", "/customers", "/catalog/products"] },
  { title: "Quản trị", color: "bg-[#693e8e]", paths: ["/admin/employees", "/admin/departments", "/admin/legal-profile", "/security-audits", "/profile"] },
];

export default function DashboardPage() {
  const user = useAuthStore(state => state.user);

  const renderGroup = (group: (typeof groups)[number], index: number) => {
    const available = group.paths.flatMap(path => {
      const tile = tiles.get(path);
      return tile && (!tile.requiredPermissions || hasAnyPermission(user?.permissions, tile.requiredPermissions)) ? [tile] : [];
    });
    if (!available.length) return null;
    return (
      <section key={group.title} aria-labelledby={`workspace-group-${index}`} className="min-w-0">
        <h2 id={`workspace-group-${index}`} className="mb-3 text-sm font-semibold text-slate-100">{group.title}</h2>
        <div className={`grid gap-3 ${index < 3 ? "grid-cols-1 sm:grid-cols-3" : index === 3 ? "grid-cols-1" : "grid-cols-2"}`}>
          {available.map(({ icon: Icon, label, href }) => (
            <Link key={href} href={href}
              className={`group relative flex min-h-24 min-w-0 flex-col justify-between gap-3 rounded-lg border border-white/20 p-3.5 text-white shadow-sm transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white motion-reduce:transition-none ${group.color}`}>
              <Icon aria-hidden="true" className="size-7 self-center" strokeWidth={1.7} />
              <ArrowUpRight aria-hidden="true" className="absolute right-2.5 top-2.5 size-3.5 opacity-60 group-hover:opacity-100" />
              <span className="wrap-break-word text-sm font-semibold leading-snug">{href === "/contracts" ? "Danh sách hợp đồng" : label}</span>
            </Link>
          ))}
        </div>
      </section>
    );
  };

  return (
    <>
      <Header title="Không gian làm việc" />
      <div className="min-h-0 grow overflow-y-auto bg-[radial-gradient(ellipse_at_top_left,#244b65,#102639_56%,#0a1928)] text-white">
        <div className="mx-auto max-w-[90rem] px-4 py-8 sm:px-8 sm:py-10">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-white/15 pb-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl border border-cyan-300/30 bg-cyan-300/10 text-cyan-200">
                <LayoutGrid aria-hidden="true" className="size-6" />
              </span>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight">{APP_NAME}</h1>
                <p className="wrap-break-word text-sm text-slate-200">{user?.tenantName || "Không gian quản lý hợp đồng"}</p>
              </div>
            </div>
            {user && <div className="flex flex-wrap items-center gap-2 text-sm text-slate-200">
              <span>{user.fullName || user.account}</span>
              <span className="rounded-full border border-white/20 px-2.5 py-1 text-xs">{user.roleName}</span>
            </div>}
          </header>
          <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="space-y-6">{groups.slice(0, 3).map(renderGroup)}</div>
            <div className="grid items-start gap-6 sm:grid-cols-2">{groups.slice(3).map((group, i) => renderGroup(group, i + 3))}</div>
          </div>
        </div>
      </div>
    </>
  );
}
