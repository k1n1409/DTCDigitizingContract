"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ColumnDef, PaginationState, Row } from "@tanstack/react-table";
import {
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  FileSignature,
  Link2,
  Plus,
  Users,
  WalletCards,
  ClipboardCheck,
} from "lucide-react";
import { Header } from "@/components/ui/custom/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/custom/data-table-server";
import { SelectFilter } from "@/components/ui/custom/select-filter";
import { SplitActionMenu } from "@/components/ui/custom/split-action-menu";
import {
  SummaryCardItem,
  SummaryCards,
} from "@/components/ui/custom/summary-cards";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/format-date";
import { useAuthStore } from "@/hooks/use-auth-store";
import { hasPermission, RBAC_PERMISSIONS } from "@/lib/rbac";
import { ContractOutcomeDialog } from "@/components/contracts/contract-outcome-dialog";
import { ContractWorkFilters } from "@/components/contracts/contract-work-filters";
import { pickWorkFilters, type ContractWorkFilter } from "@/lib/contract-work-filters";
import { getApiErrorMessage } from "@/lib/api-error";
import { clearContractList, lastAvailablePage, readContractList, rememberContractList } from "@/lib/contract-list-return";
import {
  contractApi,
  ContractFilterRequest,
  ContractListItemResponse,
  ContractStatus,
  ContractType,
  ContractDirection,
  getContractStatusLabel,
  getContractTypeLabel,
  getContractDirectionLabel,
  statusClasses,
  ContractOutcome,
  getContractOutcomeLabel,
} from "@/services/contract-api";

function ContractStatusBadge({ status, outcome = ContractOutcome.InProgress }: { status: ContractStatus; outcome?: ContractOutcome }) {
  const result = outcome || (status === ContractStatus.Completed ? ContractOutcome.Succeeded : ContractOutcome.InProgress);
  return (
    <Badge title={`Quy trình: ${getContractStatusLabel(status)}`} variant="outline" className={result === ContractOutcome.Failed ? "border-red-300 bg-red-50 text-red-700" : result === ContractOutcome.StoppedRenewal ? "border-slate-400 bg-slate-100 text-slate-700" : statusClasses[status] || ""}>
      {result ? getContractOutcomeLabel(result) : status === ContractStatus.Signed ? "Đã ký kết" : getContractStatusLabel(status)}
    </Badge>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: "All", label: "Tất cả trạng thái" },
  {
    value: String(ContractStatus.Draft),
    label: getContractStatusLabel(ContractStatus.Draft),
  },
  {
    value: String(ContractStatus.Negotiating),
    label: getContractStatusLabel(ContractStatus.Negotiating),
  },
  {
    value: String(ContractStatus.PendingAdministrativeReview),
    label: getContractStatusLabel(ContractStatus.PendingAdministrativeReview),
  },
  {
    value: String(ContractStatus.PendingApproval),
    label: getContractStatusLabel(ContractStatus.PendingApproval),
  },
  {
    value: String(ContractStatus.PendingSignature),
    label: getContractStatusLabel(ContractStatus.PendingSignature),
  },
  {
    value: String(ContractStatus.Signed),
    label: "Đã ký kết",
  },
  {
    value: String(ContractStatus.Completed),
    label: "Thành công",
  },
  {
    value: String(ContractStatus.Cancelled),
    label: getContractStatusLabel(ContractStatus.Cancelled),
  },
  {
    value: String(ContractStatus.Rejected),
    label: getContractStatusLabel(ContractStatus.Rejected),
  },
  { value: "stopped-renewal", label: "Dừng gia hạn" },
  { value: "failed", label: "Thất bại" },
];

const CONTRACT_TYPE_FILTER_OPTIONS = [
  { value: "All", label: "Tất cả loại HĐ" },
  {
    value: String(ContractType.SoftwareSupply),
    label: getContractTypeLabel(ContractType.SoftwareSupply),
  },
  {
    value: String(ContractType.SoftwareMaintenance),
    label: getContractTypeLabel(ContractType.SoftwareMaintenance),
  },
  {
    value: String(ContractType.SoftwareUpkeep),
    label: getContractTypeLabel(ContractType.SoftwareUpkeep),
  },
];

function ContractListPageContent({ scope }: { scope: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status") || "All";
  const filterStatus = STATUS_FILTER_OPTIONS.some((option) => option.value === requestedStatus) ? requestedStatus : "All";
  const href = `/contracts${searchParams.size ? `?${searchParams}` : ""}`;
  const [restored] = useState(() => readContractList(scope, href));
  const pendingCheck = useRef(restored);
  const pendingScroll = useRef(restored);
  const scrollArea = useRef<HTMLDivElement>(null);
  const previousStatus = useRef(filterStatus);
  const user = useAuthStore((state) => state.user);
  const canUpdateOutcome = hasPermission(user?.permissions, RBAC_PERMISSIONS.contractComplete);
  const [outcomeContractId, setOutcomeContractId] = useState<number | null>(null);
  const canCreate = hasPermission(
    user?.permissions,
    RBAC_PERMISSIONS.contractCreate,
  );
  const canExecuteContracts = hasPermission(
    user?.permissions,
    RBAC_PERMISSIONS.contractExecutionRead,
  );

  const [data, setData] = useState<ContractListItemResponse[]>([]);
  const [rowCount, setRowCount] = useState<number>(0);
  const [pageCount, setPageCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);

  const [pagination, setPagination] = useState<PaginationState>(restored?.pagination ?? {
    pageIndex: 0,
    pageSize: 10,
  });
  const [searchValue, setSearchValue] = useState(restored?.keyword ?? "");
  const [filterDirection, setFilterDirection] = useState(restored?.direction ?? "All");
  const [filterContractType, setFilterContractType] = useState(restored?.type ?? "All");
  const [workFilters, setWorkFilters] = useState<ContractWorkFilter>(restored?.workFilters ?? {});
  const [filtersOpen, setFiltersOpen] = useState(restored?.filtersOpen ?? false);
  const [listError, setListError] = useState("");
  const [returnNotice, setReturnNotice] = useState("");
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  useEffect(() => { clearContractList(); }, []);
  useEffect(() => {
    if (previousStatus.current === filterStatus) return;
    const timer = setTimeout(() => {
      previousStatus.current = filterStatus;
      setPagination(p => p.pageIndex ? { ...p, pageIndex: 0 } : p);
    }, 0);
    return () => clearTimeout(timer);
  }, [filterStatus]);

  const baseFilters = useMemo<ContractFilterRequest>(() => ({
    keyword: searchValue || undefined,
    contractDirection: filterDirection === "All" ? undefined : Number(filterDirection) as ContractDirection,
    status: filterStatus !== "All" && !["failed", "stopped-renewal", String(ContractStatus.Completed)].includes(filterStatus) ? Number(filterStatus) as ContractStatus : undefined,
    outcome: filterStatus === "failed" ? ContractOutcome.Failed : filterStatus === "stopped-renewal" ? ContractOutcome.StoppedRenewal : filterStatus === String(ContractStatus.Completed) ? ContractOutcome.Succeeded : filterStatus === String(ContractStatus.Signed) ? ContractOutcome.InProgress : undefined,
    contractType: filterContractType === "All" ? undefined : Number(filterContractType) as ContractType,
  }), [searchValue, filterDirection, filterStatus, filterContractType]);
  const hasFilters = Object.values(baseFilters).some(value => value !== undefined) || Object.keys(pickWorkFilters(workFilters)).length > 0;
  const paymentOnly = !Object.values(baseFilters).some(value => value !== undefined)
    && Object.keys(pickWorkFilters(workFilters)).length === 1
    && (workFilters.paymentState === 0 || workFilters.paymentState === 1);

  const useSavedFilter = (f: ContractFilterRequest) => {
    setWorkFilters(pickWorkFilters(f)); setSearchValue(f.keyword || "");
    setFilterDirection(f.contractDirection ? String(f.contractDirection) : "All"); setFilterContractType(f.contractType ? String(f.contractType) : "All");
    setPagination(p => ({ ...p, pageIndex: 0 }));
    const nextStatus = f.outcome === ContractOutcome.Failed ? "failed" : f.outcome === ContractOutcome.StoppedRenewal ? "stopped-renewal" : f.outcome === ContractOutcome.Succeeded ? String(ContractStatus.Completed) : f.status === null || f.status === undefined ? "All" : String(f.status);
    const params = new URLSearchParams(searchParams.toString()); if (nextStatus === "All") params.delete("status"); else params.set("status", nextStatus);
    router.replace(`/contracts${params.size ? `?${params}` : ""}`, { scroll: false });
  };

  const fetchContracts = useCallback(async () => {
    const current = ++sequence.current;
    let repaging = false;
    setIsLoading(true);
    try {
      const params: ContractFilterRequest = {
        ...baseFilters, ...workFilters,
        page: pagination.pageIndex + 1,
        pageSize: pagination.pageSize,
      };
      const res = await contractApi.getList(params);
      if (res && current === sequence.current) {
        setListError("");
        const returning = pendingCheck.current;
        if (returning) {
          // A missing row on this page may merely have moved to another page.
          if (hasFilters && !res.items?.some(row => row.contractId === returning.contractId)) {
            try {
              const match = await contractApi.getList({ ...params, contractId: returning.contractId, page: 1, pageSize: 1 });
              if (current !== sequence.current) return;
              if (match?.totalCount === 0) {
                const paymentLabel = ["Chưa thanh toán", "Thanh toán một phần", "Đã thanh toán đủ", "Thanh toán vượt giá trị"][workFilters.paymentState ?? -1];
                setReturnNotice(`${returning.success ? `${returning.success} ` : ""}Hợp đồng vừa mở không còn trong kết quả của bộ lọc hiện tại${paymentLabel ? ` (${paymentLabel})` : ""}.`);
              }
            } catch {
              // Membership check must not prevent the main list from loading.
            }
          }
          if (current !== sequence.current) return;
          pendingCheck.current = undefined;
        }
        const lastPage = lastAvailablePage(res.totalCount || 0, pagination.pageSize);
        if (pagination.pageIndex > lastPage) {
          repaging = true;
          setPagination(p => ({ ...p, pageIndex: lastPage }));
          return;
        }
        setData(res.items || []);
        setRowCount(res.totalCount || 0);
        setPageCount(
          res.totalPages ||
            Math.ceil((res.totalCount || 0) / pagination.pageSize),
        );
      }
    } catch (error) {
      if (current !== sequence.current) return;
      setListError(getApiErrorMessage(error, "Không tải được danh sách. Hãy thử lại."));
      console.error("Lỗi khi tải danh sách hợp đồng:", error);
      setData([]);
      setRowCount(0);
      setPageCount(0);
    } finally {
      if (current === sequence.current && !repaging) setIsLoading(false);
    }
  }, [
    pagination.pageIndex,
    pagination.pageSize,
    baseFilters,
    workFilters,
    hasFilters,
  ]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  useEffect(() => {
    if (isLoading || listError || !pendingScroll.current) return;
    const frame = requestAnimationFrame(() => {
      const position = pendingScroll.current;
      const area = scrollArea.current;
      if (!position || !area) return;
      area.scrollTop = position.scrollTop;
      area.querySelector<HTMLElement>("[data-table-scroll]")?.scrollTo(position.tableScrollLeft, position.tableScrollTop);
      pendingScroll.current = undefined;
    });
    return () => cancelAnimationFrame(frame);
  }, [isLoading, listError, data]);

  const handleView = useCallback((id: number) => {
    const table = scrollArea.current?.querySelector<HTMLElement>("[data-table-scroll]");
    rememberContractList({ scope, href, contractId: id, keyword: searchValue, direction: filterDirection, type: filterContractType,
      workFilters, filtersOpen, pagination, scrollTop: scrollArea.current?.scrollTop ?? 0, tableScrollTop: table?.scrollTop ?? 0, tableScrollLeft: table?.scrollLeft ?? 0 });
    setLoadingId(id);
    router.push(`/contracts/${id}`);
  }, [router, scope, href, searchValue, filterDirection, filterContractType, workFilters, filtersOpen, pagination]);

  const columns = useMemo<ColumnDef<ContractListItemResponse>[]>(
    () => [
      {
        id: "rowNumber",
        header: "STT",
        cell: ({ row }) => pagination.pageIndex * pagination.pageSize + row.index + 1,
        enableSorting: false,
      },
      {
        id: "select",
        header: ({ table }) => (
          <div className="flex justify-center">
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected() ||
                (table.getIsSomePageRowsSelected() && "indeterminate")
              }
              onCheckedChange={(value) =>
                table.toggleAllPageRowsSelected(!!value)
              }
              aria-label="Select all"
              className="translate-y-[2px]"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div
            className="flex justify-center"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="translate-y-[2px]"
            />
          </div>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "contractCode",
        header: "Mã hợp đồng",
        cell: ({ row }) => (
          <div className="flex flex-col pl-1">
            <span className="font-semibold text-foreground">
              {row.original.contractCode || "Chưa cấp mã"}
            </span>
            <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarDays className="h-3 w-3" />
              {formatDate(row.original.createdDate)}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => <div className="text-center">Trạng thái</div>,
        cell: ({ row }) => (
          <div className="flex justify-center">
            <ContractStatusBadge status={row.original.status} outcome={row.original.outcome} />
          </div>
        ),
      },
      {
        accessorKey: "contractName",
        header: "Thông tin hợp đồng",
        cell: ({ row }) => (
          <div className="max-w-[320px]">
            <p className="truncate font-medium text-foreground">
              {row.original.contractName}
            </p>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {getContractDirectionLabel(row.original.contractDirection)} · {getContractTypeLabel(row.original.contractType)}
            </p>
          </div>
        ),
      },
      {
        accessorKey: "customerName",
        header: "Tên khách hàng",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {row.original.customerName ||
                  row.original.customerCompany ||
                  "Chưa cập nhật"}
              </p>
              {row.original.customerCompany && (
                <p className="truncate text-xs text-muted-foreground">
                  {row.original.customerCompany}
                </p>
              )}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "responsibleEmployeeName",
        header: "Nhân viên phụ trách",
        cell: ({ row }) => {
          const isMine =
            row.original.responsibleEmployeeId === user?.employeeId;
          const isExecutionStage = [
            ContractStatus.PendingSignature,
            ContractStatus.Signed,
            ContractStatus.Completed,
          ].includes(row.original.status);
          return (
            <div className="min-w-36">
              <p className="truncate text-sm font-medium">
                {row.original.responsibleEmployeeName || "Chưa xác định"}
              </p>
              {!isMine && (
                <Badge
                  variant="outline"
                  className="mt-1 text-[10px] text-muted-foreground"
                >
                  {canExecuteContracts && isExecutionStage
                    ? "Thực hiện"
                    : "Chỉ xem"}
                </Badge>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "totalAmount",
        header: () => <div className="text-right">Giá trị</div>,
        cell: ({ row }) => (
          <div className="text-right font-semibold text-primary">
            {formatCurrency(row.original.totalAmount)}
          </div>
        ),
      },
      {
        id: "action",
        header: () => <div className="text-right pr-4">Thao tác</div>,
        cell: ({ row }) => {
          const item = row.original;
          return (
            <SplitActionMenu
              primaryLabel="Chi tiết"
              primaryIcon={<Eye className="h-4 w-4" />}
              onPrimaryClick={() => handleView(item.contractId)}
              isLoading={loadingId === item.contractId}
              menuItems={[
                ...(canUpdateOutcome ? [{
                  label: "Cập nhật kết quả hợp đồng đã ký",
                  icon: <ClipboardCheck className="h-4 w-4" />,
                  disabled: ![ContractStatus.Signed, ContractStatus.Completed].includes(item.status),
                  onClick: () => setOutcomeContractId(item.contractId),
                }] : []),
                {
                  label: "Sao chép mã hợp đồng",
                  icon: <Link2 className="h-4 w-4" />,
                  onClick: () =>
                    navigator.clipboard?.writeText(item.contractCode || ""),
                },
              ]}
            />
          );
        },
      },
    ],
    [canExecuteContracts, canUpdateOutcome, loadingId, user?.employeeId, pagination.pageIndex, pagination.pageSize, handleView],
  );

  const totalValue = useMemo(
    () => data.reduce((sum, contract) => sum + (contract.totalAmount || 0), 0),
    [data],
  );

  const signedCount = useMemo(
    () =>
      data.filter((c) =>
        [ContractStatus.Signed, ContractStatus.Completed].includes(c.status),
      ).length,
    [data],
  );

  const negotiatingCount = useMemo(
    () => data.filter((c) => c.status === ContractStatus.Negotiating).length,
    [data],
  );

  const summaryItems: SummaryCardItem[] = [
    {
      title: "Tổng hợp đồng",
      value: rowCount,
      icon: <FileSignature className="h-6 w-6" />,
      iconWrapperClassName: "bg-primary/10 text-primary",
    },
    {
      title: "Đã ký kết",
      value: signedCount,
      icon: <CheckCircle2 className="h-6 w-6" />,
      iconWrapperClassName:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-500",
    },
    {
      title: "Đang đàm phán",
      value: negotiatingCount,
      icon: <Clock className="h-6 w-6" />,
      iconWrapperClassName:
        "bg-amber-500/10 text-amber-600 dark:text-amber-500",
    },
    {
      title: "Tổng giá trị (trang)",
      value: formatCurrency(totalValue),
      icon: <WalletCards className="h-6 w-6" />,
      iconWrapperClassName: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
      valueClassName: "text-xl",
    },
  ];

  const filters = (
    <>
      <SelectFilter value={filterDirection} onChange={(value) => { setFilterDirection(value); setPagination((prev) => ({ ...prev, pageIndex: 0 })); }} options={[{ value: "All", label: "Tất cả Mua/Bán" }, { value: String(ContractDirection.Sale), label: "Bán" }, { value: String(ContractDirection.Purchase), label: "Mua" }]} placeholder="Chiều giao dịch" />
      <SelectFilter
        value={filterStatus}
        onChange={(val) => {
          const params = new URLSearchParams(searchParams.toString());
          if (val === "All") params.delete("status");
          else params.set("status", val);
          router.push(`/contracts${params.size ? `?${params}` : ""}`, { scroll: false });
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        options={STATUS_FILTER_OPTIONS}
        placeholder="Trạng thái"
      />
      <SelectFilter
        value={filterContractType}
        onChange={(val) => {
          setFilterContractType(val);
          setPagination((prev) => ({ ...prev, pageIndex: 0 }));
        }}
        options={CONTRACT_TYPE_FILTER_OPTIONS}
        placeholder="Loại hợp đồng"
      />
    </>
  );

  return (
    <>
      <Header />

      <div ref={scrollArea} className="grow overflow-y-auto p-2 lg:p-10 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Danh sách Hợp đồng
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Quản lý và theo dõi vòng đời hợp đồng: nháp, đàm phán, trình
              duyệt, ký và hoàn thành.
            </p>
          </div>
          {canCreate && (
            <div className="flex flex-wrap gap-2">
              <Button className="shadow-sm" onClick={() => router.push("/contract-word-templates")}>
                <Plus className="mr-2 h-4 w-4" /> Tạo từ mẫu Word
              </Button>
              <Button variant="outline" onClick={() => router.push("/contracts/create")}>Tạo nháp theo biểu mẫu</Button>
            </div>
          )}
        </div>

        <SummaryCards items={summaryItems} />
        <ContractWorkFilters value={workFilters} context={baseFilters} open={filtersOpen} setOpen={setFiltersOpen} onApply={value => { setWorkFilters(value); setPagination(p => ({ ...p, pageIndex: 0 })); }} onUseSaved={useSavedFilter} />
        {listError && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-destructive">{listError}<Button variant="outline" className="ml-3" onClick={() => void fetchContracts()}>Thử lại</Button></p>}
        {returnNotice && <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm"><span>{returnNotice}</span><Button variant="ghost" size="sm" onClick={() => setReturnNotice("")}>Đóng thông báo</Button></div>}

        <Card className="border-border shadow-sm bg-card min-h-[500px] flex flex-col gap-0 p-0">
          <CardContent className="p-4 flex flex-col justify-between flex-1 pb-0">
            <DataTable
              columns={columns}
              data={data}
              pageCount={pageCount}
              rowCount={rowCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              searchValue={searchValue}
              onSearchChange={(val) => {
                setSearchValue(val);
                setPagination((prev) => ({ ...prev, pageIndex: 0 }));
              }}
              searchPlaceholder="Tìm mã hoặc tên hợp đồng..."
              filterSlot={filters}
              isLoading={isLoading}
              restorePageSize={!restored}
              emptyMessage={listError ? "Chưa thể tải dữ liệu hợp đồng." : paymentOnly ? "Không có việc cần xử lý trong nhóm thanh toán đang chọn." : hasFilters ? "Không có hợp đồng khớp bộ lọc. Hãy đổi hoặc bỏ bớt điều kiện." : "Chưa có hợp đồng nào trong phạm vi bạn được xem."}
              onRowClick={(row) => handleView(row.contractId)}
              mobileCardRenderer={(
                row: Row<ContractListItemResponse>,
                { isSelected, actionCell },
              ) => {
                const item = row.original;
                return (
                  <div
                    className={`rounded-xl border bg-card p-4 shadow-sm transition-colors active:bg-secondary/40 ${
                      isSelected
                        ? "border-primary/40 bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">STT {pagination.pageIndex * pagination.pageSize + row.index + 1}</p>
                        <p className="font-semibold text-foreground">
                          {item.contractCode || "Chưa cấp mã"}
                        </p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {item.contractName}
                        </p>
                      </div>
                      <ContractStatusBadge status={item.status} outcome={item.outcome} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/40 p-2.5 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Tên khách hàng
                        </p>
                        <p className="truncate font-medium">
                          {item.customerName ||
                            item.customerCompany ||
                            "Chưa cập nhật"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Giá trị</p>
                        <p className="truncate font-semibold text-primary">
                          {formatCurrency(item.totalAmount)}
                        </p>
                      </div>
                      <div className="col-span-2 border-t pt-2">
                        <p className="text-xs text-muted-foreground">
                          Nhân viên phụ trách
                        </p>
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium">
                            {item.responsibleEmployeeName || "Chưa xác định"}
                          </p>
                          {item.responsibleEmployeeId !== user?.employeeId && (
                            <Badge variant="outline">Chỉ xem</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    {actionCell}
                  </div>
                );
              }}
            />
          </CardContent>
        </Card>
      </div>
      {outcomeContractId !== null && <ContractOutcomeDialog key={outcomeContractId} contractId={outcomeContractId} onClose={() => setOutcomeContractId(null)} onUpdated={() => void fetchContracts()} />}
    </>
  );
}

function ContractListRoute() {
  const user = useAuthStore(state => state.user);
  if (!user) return <p className="p-6">Đang tải tài khoản...</p>;
  const scope = `${user.tenantId}:${user.employeeId}`;
  return <ContractListPageContent key={scope} scope={scope} />;
}

export default function ContractListPage() {
  return <Suspense fallback={<p className="p-6">Đang tải danh sách hợp đồng...</p>}><ContractListRoute /></Suspense>;
}
