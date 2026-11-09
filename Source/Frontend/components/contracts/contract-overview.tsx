"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  FileSignature,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/format-currency";
import { cn } from "@/lib/utils";
import { ContractLookupPicker } from "./contract-lookup-picker";
import { DateRangeFilter } from "@/components/ui/custom/date-range-filter";
import { DecimalInput } from "@/components/ui/custom/decimal-input";
import { IntegerInput } from "@/components/ui/custom/integer-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { catalogPickerApi } from "@/services/catalog/picker-api";

import {
  customerApi,
  CustomerStatus,
  type CustomerLookupResponse,
} from "@/services/customers-api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ContractDetailResponse,
  ContractDirection,
  ContractLanguageMode,
  ContractStatus,
  ContractItemType,
  ContractItemDiscountMode,
  canEditDirectWordDraftSettings,
  getContractTypeLabel,
  getContractDirectionLabel,
  getContractCounterpartyLabel,
  getContractLanguageModeLabel,
} from "@/services/contract-api";
import { InfoCard } from "./contract-helpers";
import { formatDate } from "@/lib/format-date";
import {
  calculateContractItemAmounts,
  calculateContractTotals,
} from "@/lib/contract-finance";

interface CatalogItem {
  id: string;
  originalId: number;
  itemName: string;
  itemNameEn: string;
  unitName: string | null;
  unitNameEn: string | null;
  itemType: ContractItemType;
  unitPrice: number;
}

export function ContractOverview({
  contract,
  setContract,
  canEdit,
  onOpenTransferModal,
}: {
  contract: ContractDetailResponse;
  setContract: React.Dispatch<
    React.SetStateAction<ContractDetailResponse | null>
  >;
  canEdit: boolean;
  onOpenTransferModal?: () => void;
}) {
  const isEditable = canEdit;
  const isDraftEditable = isEditable && contract.status === ContractStatus.Draft;
  const canEditDocumentSettings = isEditable && canEditDirectWordDraftSettings(contract);
  const isBilingual = contract.languageMode === ContractLanguageMode.Bilingual;

  const draftFinancialTotals = useMemo(
    () =>
      calculateContractTotals(
        contract.currentVersion?.items || [],
        contract.currencyCode,
      ),
    [contract.currentVersion?.items, contract.currencyCode],
  );

  const persistedFinancialTotals = {
    subtotal: contract.subtotal ?? contract.currentVersion?.subtotal ?? 0,
    totalDiscount:
      contract.totalDiscount ?? contract.currentVersion?.totalDiscount ?? 0,
    totalVat: contract.totalVat ?? contract.currentVersion?.totalVat ?? 0,
    totalPayment:
      contract.totalPayment ??
      contract.currentVersion?.totalPayment ??
      contract.totalAmount ??
      0,
  };

  const hasUnsavedFinancialChanges =
    isEditable &&
    (Math.abs(
      draftFinancialTotals.subtotal - persistedFinancialTotals.subtotal,
    ) > 0.009 ||
      Math.abs(
        draftFinancialTotals.totalDiscount -
          persistedFinancialTotals.totalDiscount,
      ) > 0.009 ||
      Math.abs(
        draftFinancialTotals.totalVat - persistedFinancialTotals.totalVat,
      ) > 0.009 ||
      Math.abs(
        draftFinancialTotals.totalPayment -
          persistedFinancialTotals.totalPayment,
      ) > 0.009);

  const financialTotals = isEditable
    ? draftFinancialTotals
    : persistedFinancialTotals;

  const [customers, setCustomers] = useState<CustomerLookupResponse[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (isEditable) {
      let cancelled = false;
      setCustomerLoading(true);
      setCustomerError("");
      customerApi
        .lookup()
        .then((items) => {
          if (!cancelled) setCustomers(items.filter((customer) => customer.status === CustomerStatus.Active));
        })
        .catch(() => {
          if (!cancelled) setCustomerError("Không tải được danh sách đối tác. Hãy thử tải lại trang.");
        })
        .finally(() => {
          if (!cancelled) setCustomerLoading(false);
        });
      return () => { cancelled = true; };
    }
  }, [isEditable]);

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [catalogTab, setCatalogTab] = useState<"all" | "service" | "product">(
    "all",
  );
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogPageSize, setCatalogPageSize] = useState(5);
  const [catalogTotalCount, setCatalogTotalCount] = useState(0);
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(catalogTotalCount / catalogPageSize),
  );

  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [debouncedCatalogQuery, setDebouncedCatalogQuery] = useState("");
  const isCatalogPending =
    isLoadingCatalog || catalogSearchQuery.trim() !== debouncedCatalogQuery;

  useEffect(() => {
    if (catalogSearchQuery.trim() === debouncedCatalogQuery) return;
    const handler = setTimeout(() => {
      setDebouncedCatalogQuery(catalogSearchQuery.trim());
      setCatalogPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [catalogSearchQuery, debouncedCatalogQuery]);

  const [itemsSearchQuery, setItemsSearchQuery] = useState("");
  const [itemsTab, setItemsTab] = useState<"all" | "product" | "service">(
    "all",
  );
  const [itemsCurrentPage, setItemsCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const currentItemType =
    itemsTab === "product"
      ? ContractItemType.Product
      : ContractItemType.Service;
  const filteredItems = (contract.currentVersion?.items || []).filter(
    (item) =>
      (itemsTab === "all" || item.itemType === currentItemType) &&
      ([item.itemName, item.itemCode, item.itemNameEn].some((value) =>
        value?.toLocaleLowerCase("vi").includes(itemsSearchQuery.trim().toLocaleLowerCase("vi"))) ||
        (isDraftEditable && expandedItems[item.contractItemId] === true)),
  );

  const itemsTotalPages = Math.ceil(filteredItems.length / itemsPerPage);

  useEffect(() => {
    if (itemsCurrentPage > itemsTotalPages && itemsTotalPages > 0) {
      setItemsCurrentPage(itemsTotalPages);
    }
  }, [itemsTotalPages, itemsCurrentPage]);

  const paginatedItems = filteredItems.slice(
    (itemsCurrentPage - 1) * itemsPerPage,
    itemsCurrentPage * itemsPerPage,
  );

  useEffect(() => {
    if (isCatalogOpen && isEditable) {
      const controller = new AbortController();
      const fetchCatalog = async () => {
        setIsLoadingCatalog(true);
        setCatalogItems([]);
        try {
          const result = await catalogPickerApi.search(
            {
              page: catalogPage,
              pageSize: catalogPageSize,
              keyword: debouncedCatalogQuery,
              itemType:
                catalogTab === "all"
                  ? undefined
                  : catalogTab === "product"
                    ? ContractItemType.Product
                    : ContractItemType.Service,
            },
            controller.signal,
          );

          if (controller.signal.aborted) return;
          setCatalogTotalCount(result.totalCount);
          const lastPage = Math.max(1, result.totalPages);
          if (catalogPage > lastPage) {
            setCatalogPage(lastPage);
            return;
          }
          setCatalogItems(
            result.items.map((item) => ({
              id: `${item.itemType === ContractItemType.Product ? "p" : "s"}-${item.sourceId}`,
              originalId: item.sourceId,
              itemName: item.name || "Sản phẩm/dịch vụ không tên",
              itemNameEn: item.nameEn ?? "",
              unitName: item.unitName,
              unitNameEn: item.unitNameEn,
              itemType: item.itemType,
              unitPrice: item.price ?? 0,
            })),
          );
        } catch (error) {
          if (!controller.signal.aborted) {
            setCatalogItems([]);
            setCatalogTotalCount(0);
            toast.error("Không thể tải danh sách sản phẩm và dịch vụ.");
            console.error(error);
          }
        } finally {
          if (!controller.signal.aborted) setIsLoadingCatalog(false);
        }
      };
      void fetchCatalog();
      return () => controller.abort();
    }
  }, [
    isCatalogOpen,
    isEditable,
    debouncedCatalogQuery,
    catalogTab,
    catalogPage,
    catalogPageSize,
  ]);

  const handleAddCatalogItem = (catalogItem: CatalogItem) => {
    if (!contract || !contract.currentVersion) return;
    if (
      !isDraftEditable &&
      (!catalogItem.unitName?.trim() ||
        (isBilingual && !catalogItem.unitNameEn?.trim()))
    ) {
      toast.error(
        `“${catalogItem.itemName}” thiếu đơn vị trong danh mục. Hãy cập nhật sản phẩm/dịch vụ trước khi thêm vào hợp đồng.`,
      );
      return;
    }

    const exists = contract.currentVersion.items.some(
      (i) =>
        (catalogItem.itemType === ContractItemType.Product &&
          i.sourceProductId === catalogItem.originalId) ||
        (catalogItem.itemType === ContractItemType.Service &&
          i.sourceServiceId === catalogItem.originalId),
    );

    if (exists) {
      toast.info("Sản phẩm/dịch vụ này đã có trong hợp đồng.");
      return;
    }

    const newItem: any = {
      contractItemId: -(Math.floor(Math.random() * 100000) + 1),
      rowVersion: "",
      itemType: catalogItem.itemType,
      sourceProductId:
        catalogItem.itemType === ContractItemType.Product
          ? catalogItem.originalId
          : null,
      sourceServiceId:
        catalogItem.itemType === ContractItemType.Service
          ? catalogItem.originalId
          : null,
      itemCode: null,
      itemName: catalogItem.itemName,
      itemNameEn: catalogItem.itemNameEn,
      itemDescription: null,
      itemDescriptionEn: null,
      unitName: catalogItem.unitName,
      unitNameEn: catalogItem.unitNameEn,
      quantity: 1,
      unitPrice: catalogItem.unitPrice,
      discountMode: ContractItemDiscountMode.None,
      discountPercent: 0,
      fixedDiscountAmount: 0,
      isTaxable: true,
      vatPercent: 10,
      displayOrder: contract.currentVersion.items.length + 1,
    };

    setContract((prev) => {
      if (!prev || !prev.currentVersion) return prev;
      return {
        ...prev,
        currentVersion: {
          ...prev.currentVersion,
          items: [...prev.currentVersion.items, newItem],
        },
      };
    });

    toast.success(`Đã thêm ${catalogItem.itemName}`);
    setExpandedItems({ [newItem.contractItemId]: true });
    setItemsTab(
      catalogItem.itemType === ContractItemType.Product ? "product" : "service",
    );
    setItemsSearchQuery("");
    const nextCount =
      contract.currentVersion.items.filter(
        (item) => item.itemType === catalogItem.itemType,
      ).length + 1;
    setItemsCurrentPage(Math.ceil(nextCount / itemsPerPage));
  };

  const toLocalISOString = (date?: Date | null) => {
    if (!date) return null;
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString();
  };

  const handleRootChange = <K extends keyof ContractDetailResponse>(
    field: K,
    value: ContractDetailResponse[K],
  ) => {
    setContract((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleItemPatch = (itemId: number, patch: Record<string, unknown>) => {
    setContract((prev) => {
      if (!prev || !prev.currentVersion) return prev;
      const updatedItems = prev.currentVersion.items.map((item) =>
        item.contractItemId === itemId ? { ...item, ...patch } : item,
      );
      return {
        ...prev,
        currentVersion: { ...prev.currentVersion, items: updatedItems },
      };
    });
  };

  const handleItemChange = (itemId: number, field: string, value: unknown) => {
    handleItemPatch(itemId, { [field]: value });
  };

  const handleRemoveItem = (contractItemId: number) => {
    setContract((prev) => {
      if (!prev || !prev.currentVersion) return prev;
      const updatedItems = prev.currentVersion.items.filter(
        (item) => item.contractItemId !== contractItemId,
      );
      return {
        ...prev,
        currentVersion: { ...prev.currentVersion, items: updatedItems },
      };
    });
  };

  const handleCustomerChange = (value: string) => {
    const found = customers.find((customer) => customer.customerId === Number(value));
    if (!found) return;
    setContract((previous) => previous ? {
      ...previous,
      customer: {
        ...previous.customer,
        customerId: found.customerId,
        customerCode: found.customerCode,
        customerFullName: found.customerFullName,
        customerCompany: found.customerCompany,
      },
    } : previous);
  };

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
      <Card className="min-w-0">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>{isDraftEditable ? "Thông tin bản nháp" : "Tổng quan hợp đồng"}</CardTitle>
            {isDraftEditable && <Badge variant="secondary"><Pencil className="size-3" /> Có thể chỉnh sửa</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {isDraftEditable ? "Cập nhật thông tin và các hạng mục bên dưới, sau đó chọn Lưu thay đổi." : <>
            Chiều giao dịch:{" "}
            {getContractDirectionLabel(contract.contractDirection)} — Đối tác:{" "}
            {getContractCounterpartyLabel(contract.contractDirection)}
            </>}
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          {isDraftEditable && (
            <details className="rounded-xl border bg-muted/20">
              <summary className="cursor-pointer px-4 py-3 text-sm">
                <Settings2 aria-hidden className="mx-2 inline size-4 align-text-bottom text-primary" />
                <span className="font-semibold">Thiết lập hợp đồng</span>
                <span className="ml-2 inline-block text-xs text-muted-foreground">
                  {getContractDirectionLabel(contract.contractDirection)} · {getContractLanguageModeLabel(contract.languageMode)}
                </span>
              </summary>
              <div className="grid gap-4 border-t p-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <p className="text-sm text-muted-foreground">Loại hợp đồng</p>
                <p className="text-sm font-medium">{getContractTypeLabel(contract.contractType)}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground" htmlFor="draft-contract-direction">Chiều giao dịch</label>
                {canEditDocumentSettings ? (
                  <Select value={String(contract.contractDirection)} onValueChange={(value) => handleRootChange("contractDirection", Number(value) as ContractDirection)}>
                    <SelectTrigger id="draft-contract-direction" className="w-full bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(ContractDirection.Sale)}>Bán</SelectItem>
                      <SelectItem value={String(ContractDirection.Purchase)}>Mua</SelectItem>
                    </SelectContent>
                  </Select>
                ) : <p className="text-sm font-medium">{getContractDirectionLabel(contract.contractDirection)}</p>}
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-muted-foreground" htmlFor="draft-contract-language">Ngôn ngữ</label>
                {canEditDocumentSettings ? (
                  <Select value={String(contract.languageMode)} onValueChange={(value) => {
                    const mode = Number(value) as ContractLanguageMode;
                    if (mode === ContractLanguageMode.Vietnamese && (
                      contract.currentVersion.terms.some((term) => term.bilingualContentMode === 2)
                      || contract.currentVersion.appendices.some((appendix) =>
                        appendix.terms.some((term) => term.bilingualContentMode === 2))
                    )) {
                      toast.error("Hãy chuyển các điều khoản và phụ lục đang gộp song ngữ sang nội dung tách riêng trước khi đổi ngôn ngữ.");
                      return;
                    }
                    handleRootChange("languageMode", mode);
                  }}>
                    <SelectTrigger id="draft-contract-language" className="w-full bg-background"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(ContractLanguageMode.Vietnamese)}>Tiếng Việt</SelectItem>
                      <SelectItem value={String(ContractLanguageMode.Bilingual)}>Song ngữ</SelectItem>
                    </SelectContent>
                  </Select>
                ) : <p className="text-sm font-medium">{getContractLanguageModeLabel(contract.languageMode)}</p>}
              </div>
              {!canEditDocumentSettings && (
                <p className="text-xs text-muted-foreground sm:col-span-3">Chiều giao dịch và ngôn ngữ được giữ theo cấu hình của hồ sơ này.</p>
              )}
              </div>
            </details>
          )}
          {/* SỬA TÊN HỢP ĐỒNG */}
          <div>
            <label htmlFor={isEditable ? "overview-contract-name" : undefined} className="mb-1 block text-sm font-semibold text-muted-foreground">
              Tên hợp đồng
            </label>
            {isEditable ? (
              <Input
                id="overview-contract-name"
                maxLength={1000}
                value={contract.contractName}
                onChange={(e) =>
                  handleRootChange("contractName", e.target.value)
                }
                className="text-lg"
              />
            ) : (
              <p className="text-lg font-semibold">{contract.contractName}</p>
            )}
          </div>

          {contract.languageMode === ContractLanguageMode.Bilingual && (
            <div>
              <label htmlFor={isEditable ? "overview-contract-name-en" : undefined} className="mb-1 block text-sm font-semibold text-muted-foreground">
                Tên hợp đồng tiếng Anh
              </label>
              {isEditable ? (
                <Input
                  id="overview-contract-name-en"
                  maxLength={1000}
                  value={contract.contractNameEn || ""}
                  onChange={(e) =>
                    handleRootChange("contractNameEn", e.target.value)
                  }
                  placeholder="Nhập tên hợp đồng bằng tiếng Anh..."
                />
              ) : (
                <p className="font-medium">
                  {contract.contractNameEn || "Chưa cập nhật"}
                </p>
              )}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {isEditable ? (
              <div className="rounded-xl border bg-muted/20 p-4">
                <label htmlFor="overview-counterparty" className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Users className="size-4" />{" "}
                  {getContractCounterpartyLabel(contract.contractDirection)}
                </label>
                {isDraftEditable ? <ContractLookupPicker
                  id="overview-counterparty"
                  label={getContractCounterpartyLabel(contract.contractDirection)}
                  value={String(contract.customer?.customerId || "")}
                  selectedLabel={contract.customer?.customerCompany || contract.customer?.customerFullName || undefined}
                  search={customerQuery}
                  searchPlaceholder="Tìm theo tên, mã hoặc mã số thuế…"
                  onSearchChange={setCustomerQuery}
                  onSelect={handleCustomerChange}
                  loading={customerLoading}
                  error={customerError}
                  options={customers.flatMap((customer) => {
                    const label = customer.customerCompany || customer.customerFullName || customer.customerCode || "Chưa có tên";
                    const details = [customer.customerCode, customer.customerTaxCode && `MST ${customer.customerTaxCode}`].filter(Boolean).join(" · ");
                    const haystack = `${label} ${customer.customerFullName ?? ""} ${details}`.toLocaleLowerCase("vi");
                    return haystack.includes(customerQuery.trim().toLocaleLowerCase("vi")) ? [{ id: String(customer.customerId), label, detail: details }] : [];
                  })}
                /> : <Select
                  value={String(contract.customer?.customerId || "")}
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger id="overview-counterparty" className="w-full h-9 bg-background">
                    <SelectValue
                      placeholder={`Chọn ${getContractCounterpartyLabel(contract.contractDirection).toLocaleLowerCase()}`}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem
                        key={c.customerId}
                        value={String(c.customerId)}
                      >
                        {c.customerCompany || c.customerFullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>}
              </div>
            ) : (
              <InfoCard
                icon={<Users className="size-4" />}
                label={getContractCounterpartyLabel(contract.contractDirection)}
                value={
                  contract.customer?.customerCompany ||
                  contract.customer?.customerFullName
                }
              />
            )}

            {/* SỬA NGÀY THÁNG */}
            <div className="rounded-xl border bg-muted/20 p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <CalendarDays className="size-4" /> Hiệu lực
              </div>
              {isEditable ? (
                <DateRangeFilter
                  compact
                  confirmOnDaySelect
                  dateRange={{
                    from: contract.effectiveDate
                      ? new Date(contract.effectiveDate)
                      : undefined,
                    to: contract.expireDate
                      ? new Date(contract.expireDate)
                      : undefined,
                  }}
                  onChange={(range) => {
                    handleRootChange(
                      "effectiveDate",
                      toLocalISOString(range.from),
                    );
                    handleRootChange("expireDate", toLocalISOString(range.to));
                  }}
                />
              ) : (
                <div className="font-semibold text-foreground">
                  {`${formatDate(contract.effectiveDate)} - ${formatDate(contract.expireDate)}`}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* SỬA SẢN PHẨM / DỊCH VỤ (ITEMS) */}
          <Tabs
            value={itemsTab}
            onValueChange={(value) => {
              if (value !== "all" && value !== "product" && value !== "service")
                return;
              setItemsTab(value);
              setItemsCurrentPage(1);
              setItemsSearchQuery("");
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="flex items-center gap-2 font-semibold"><Package aria-hidden className="size-4 text-primary" /> Sản phẩm và dịch vụ</h4>
                {isDraftEditable && <p className="mt-0.5 text-xs text-muted-foreground">Chỉnh từng hạng mục mà không thay đổi danh mục gốc.</p>}
              </div>
              {isEditable && (
                <Dialog
                  open={isCatalogOpen}
                  onOpenChange={(open) => {
                    setIsCatalogOpen(open);
                    if (open) setCatalogPage(1);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button variant={isDraftEditable ? "default" : "outline"} size="sm">
                      <Plus className="size-4" />
                      Thêm hạng mục
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-8xl max-h-[80vh] flex flex-col">
                    <DialogHeader>
                      <DialogTitle>Thêm Sản phẩm / Dịch vụ</DialogTitle>
                    </DialogHeader>

                    <Tabs
                      value={catalogTab}
                      onValueChange={(value) => {
                        if (
                          value === "all" ||
                          value === "service" ||
                          value === "product"
                        ) {
                          setCatalogTab(value);
                          setCatalogPage(1);
                        }
                      }}
                      className="flex min-h-0 flex-1 flex-col"
                    >
                      <TabsList className="w-full shrink-0">
                        <TabsTrigger value="all" className="flex-1">
                          Tất cả
                        </TabsTrigger>
                        <TabsTrigger value="product" className="flex-1">
                          Sản phẩm
                        </TabsTrigger>
                        <TabsTrigger value="service" className="flex-1">
                          Dịch vụ
                        </TabsTrigger>
                      </TabsList>
                      <div className="relative mt-2">
                        <Input
                          type="text"
                          placeholder="Tìm theo mã hoặc tên sản phẩm/dịch vụ..."
                          className="bg-background w-full"
                          value={catalogSearchQuery}
                          onChange={(e) =>
                            setCatalogSearchQuery(e.target.value)
                          }
                        />
                      </div>

                      <TabsContent
                        value={catalogTab}
                        className="min-h-0 flex-1 overflow-y-auto pr-2 space-y-2 mt-4"
                      >
                        {isCatalogPending ? (
                          <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                            <Loader2 className="size-5 animate-spin text-primary" />
                            Đang tải danh sách...
                          </div>
                        ) : catalogItems.length === 0 ? (
                          <p className="py-8 text-center text-sm text-muted-foreground">
                            Không tìm thấy{" "}
                            {catalogTab === "product"
                              ? "sản phẩm"
                              : catalogTab === "service"
                                ? "dịch vụ"
                                : "sản phẩm/dịch vụ"}{" "}
                            phù hợp.
                          </p>
                        ) : (
                          catalogItems.map((item) => (
                            <button
                              type="button"
                              key={item.id}
                              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer w-full text-left"
                              onClick={() => handleAddCatalogItem(item)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                  <Package className="size-5" />
                                </div>
                                <div>
                                  <p className="font-medium">{item.itemName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {item.itemType === ContractItemType.Product
                                      ? "Sản phẩm"
                                      : "Dịch vụ"}
                                  </p>
                                </div>
                              </div>
                              <span className="font-semibold text-primary">
                                {formatCurrency(
                                  item.unitPrice,
                                  contract.currencyCode,
                                )}
                              </span>
                            </button>
                          ))
                        )}
                      </TabsContent>
                      <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t pt-3">
                        <p
                          className="text-xs text-muted-foreground"
                          aria-live="polite"
                        >
                          {catalogTotalCount} mục · Trang {catalogPage}/
                          {catalogTotalPages}
                        </p>
                        <div className="flex items-center gap-2">
                          <Select
                            value={String(catalogPageSize)}
                            disabled={isCatalogPending}
                            onValueChange={(value) => {
                              setCatalogPageSize(Number(value));
                              setCatalogPage(1);
                            }}
                          >
                            <SelectTrigger
                              aria-label="Số sản phẩm/dịch vụ mỗi trang"
                              className="h-8 w-[110px] text-xs"
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent showSearch={false}>
                              {[5, 10, 20].map((size) => (
                                <SelectItem key={size} value={String(size)}>
                                  {size} / trang
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isCatalogPending || catalogPage <= 1}
                            onClick={() =>
                              setCatalogPage((page) => Math.max(1, page - 1))
                            }
                          >
                            <ChevronLeft className="size-4" />
                            Trước
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                              isCatalogPending ||
                              catalogPage >= catalogTotalPages
                            }
                            onClick={() =>
                              setCatalogPage((page) =>
                                Math.min(catalogTotalPages, page + 1),
                              )
                            }
                          >
                            Sau
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </Tabs>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <TabsList className="mb-3">
              <TabsTrigger value="all">
                Tất cả ({contract.currentVersion?.items.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="product">
                Sản phẩm (
                {contract.currentVersion?.items.filter(
                  (item) => item.itemType === ContractItemType.Product,
                ).length ?? 0}
                )
              </TabsTrigger>
              <TabsTrigger value="service">
                Dịch vụ (
                {contract.currentVersion?.items.filter(
                  (item) => item.itemType === ContractItemType.Service,
                ).length ?? 0}
                )
              </TabsTrigger>
            </TabsList>
            <TabsContent value={itemsTab}>
              {/* Thanh tìm kiếm Items */}
              {((contract.currentVersion?.items?.length || 0) > (isDraftEditable ? 1 : 0) || itemsSearchQuery) && (
                <div className="relative mb-3">
                  <Input
                    type="text"
                    placeholder="Tìm kiếm sản phẩm / dịch vụ..."
                    className="bg-background w-full"
                    aria-label="Tìm hạng mục trong hợp đồng"
                    value={itemsSearchQuery}
                    onChange={(e) => {
                      setItemsSearchQuery(e.target.value);
                      setItemsCurrentPage(1);
                      setExpandedItems({});
                    }}
                  />
                </div>
              )}

              <div className="space-y-3">
                {filteredItems.length === 0 && (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {itemsSearchQuery
                      ? "Không tìm thấy mục phù hợp."
                      : itemsTab === "product"
                        ? "Chưa có sản phẩm trong hợp đồng."
                        : itemsTab === "service"
                          ? "Chưa có dịch vụ trong hợp đồng."
                          : "Chưa có sản phẩm / dịch vụ trong hợp đồng."}
                  </p>
                )}
                {paginatedItems.map((item) => {
                  const expanded = !isDraftEditable || (expandedItems[item.contractItemId] ?? contract.currentVersion.items.length === 1);
                  const missingInfo = !item.itemName.trim() || !item.unitName?.trim() ||
                    (isBilingual && (!item.itemNameEn?.trim() || !item.unitNameEn?.trim()));
                  const amounts = isEditable
                    ? calculateContractItemAmounts(item, contract.currencyCode)
                    : {
                        lineSubtotal: item.lineSubtotal,
                        discountAmount: item.discountAmount,
                        vatAmount: item.vatAmount,
                        lineTotal: item.lineTotal,
                      };

                  return (
                    <div
                      key={item.contractItemId}
                      className={cn("overflow-hidden rounded-xl border bg-background", isDraftEditable && missingInfo && "border-amber-500/55")}
                    >
                      <div className={cn("flex items-start justify-between gap-2 bg-muted/20 p-3 sm:px-4", expanded && "border-b")}>
                        <div className="min-w-0 flex-1">
                          <p className="break-words font-semibold">{item.itemName || "Hạng mục chưa có tên"}</p>
                          <p className="mt-1 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                            {item.itemCode ||
                              (item.itemType === ContractItemType.Product
                                ? "Sản phẩm"
                                : "Dịch vụ")}
                            {isDraftEditable && !expanded && <span>{item.quantity} {item.unitName} · <strong className="text-primary">{formatCurrency(amounts.lineTotal, contract.currencyCode)}</strong></span>}
                          </p>
                          {isDraftEditable && missingInfo && <Badge variant="outline" className="mt-1 border-amber-500/50 text-amber-800 dark:text-amber-300">Thiếu thông tin</Badge>}
                        </div>
                        {isDraftEditable && <Button type="button" variant="outline" size="sm"
                          aria-expanded={expanded} aria-controls={`draft-item-fields-${item.contractItemId}`}
                          aria-label={`${expanded ? "Thu gọn" : "Sửa"} ${item.itemName || "hạng mục"}`}
                          onClick={() => setExpandedItems((previous) => ({ ...previous, [item.contractItemId]: !expanded }))}>
                          <span className="hidden sm:inline">{expanded ? "Thu gọn" : "Sửa"}</span>
                          <ChevronDown className={cn("size-4", expanded && "rotate-180")} />
                        </Button>}
                        {isEditable && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            title="Bỏ hạng mục khỏi hợp đồng"
                            className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              handleRemoveItem(item.contractItemId)
                            }
                          >
                            <Trash2 className="size-4" />
                            <span className="sr-only">Bỏ {item.itemName || "hạng mục"} khỏi hợp đồng</span>
                          </Button>
                        )}
                      </div>

                      <div id={`draft-item-fields-${item.contractItemId}`} hidden={!expanded}>
                      {isEditable ? (
                        <>
                          {isDraftEditable && (
                            <div className="space-y-3 border-b px-4 py-4">
                              <h5 className="text-sm font-semibold">Thông tin hạng mục</h5>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                  <span>Tên sản phẩm / dịch vụ</span>
                                  <Input maxLength={500} value={item.itemName} onChange={(event) => handleItemChange(item.contractItemId, "itemName", event.target.value)} />
                                </label>
                                <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                  <span>Đơn vị tính</span>
                                  <Input maxLength={100} value={item.unitName ?? ""} onChange={(event) => handleItemPatch(item.contractItemId, { unitName: event.target.value, overrideCatalogUnit: true })} />
                                </label>
                                {isBilingual && (
                                  <>
                                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                      <span>Tên tiếng Anh</span>
                                      <Input maxLength={500} value={item.itemNameEn ?? ""} onChange={(event) => handleItemChange(item.contractItemId, "itemNameEn", event.target.value)} />
                                    </label>
                                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                      <span>Đơn vị tính tiếng Anh</span>
                                      <Input maxLength={100} value={item.unitNameEn ?? ""} onChange={(event) => handleItemPatch(item.contractItemId, { unitNameEn: event.target.value, overrideCatalogUnit: true })} />
                                    </label>
                                  </>
                                )}
                              </div>
                              <details className="rounded-lg border bg-muted/15 px-3 py-2">
                                <summary className="cursor-pointer text-sm font-medium">Mô tả sản phẩm / dịch vụ</summary>
                                <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                  <label className={`space-y-1.5 text-xs font-medium text-muted-foreground ${isBilingual ? "" : "sm:col-span-2"}`}>
                                    <span>{isBilingual ? "Mô tả tiếng Việt" : "Mô tả"}</span>
                                    <Textarea value={item.itemDescription ?? ""} onChange={(event) => handleItemChange(item.contractItemId, "itemDescription", event.target.value)} />
                                  </label>
                                  {isBilingual && (
                                    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
                                      <span>Mô tả tiếng Anh</span>
                                      <Textarea value={item.itemDescriptionEn ?? ""} onChange={(event) => handleItemChange(item.contractItemId, "itemDescriptionEn", event.target.value)} />
                                    </label>
                                  )}
                                </div>
                              </details>
                            </div>
                          )}
                          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                            {isDraftEditable && <h5 className="text-sm font-semibold sm:col-span-2 xl:col-span-4">Số lượng và giá</h5>}
                            {!isDraftEditable && <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Đơn vị đã lấy từ danh mục
                              </span>
                              <p className="text-sm">
                                {item.unitName || "Chưa có đơn vị"}
                              </p>
                              {contract.languageMode ===
                                ContractLanguageMode.Bilingual && (
                                <p className="text-xs text-muted-foreground">
                                  {item.unitNameEn ||
                                    "Chưa có đơn vị tiếng Anh"}
                                </p>
                              )}
                            </div>}
                            {!isDraftEditable && contract.languageMode ===
                              ContractLanguageMode.Bilingual && (
                              <div className="space-y-1.5 sm:col-span-2 xl:col-span-5">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Tên sản phẩm / dịch vụ tiếng Anh
                                </span>
                                <Input
                                  value={item.itemNameEn || ""}
                                  onChange={(e) =>
                                    handleItemChange(
                                      item.contractItemId,
                                      "itemNameEn",
                                      e.target.value,
                                    )
                                  }
                                  placeholder="Nhập tên sản phẩm/dịch vụ bằng tiếng Anh..."
                                />
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Số lượng
                              </span>
                              <IntegerInput
                                min={1}
                                value={item.quantity}
                                onValueChange={(value) =>
                                  handleItemChange(
                                    item.contractItemId,
                                    "quantity",
                                    value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Đơn giá
                              </span>
                              <DecimalInput
                                min={0}
                                value={item.unitPrice}
                                onValueChange={(value) =>
                                  handleItemChange(
                                    item.contractItemId,
                                    "unitPrice",
                                    value,
                                  )
                                }
                              />
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Chiết khấu
                              </span>
                              <Select
                                value={String(item.discountMode)}
                                onValueChange={(value) =>
                                  handleItemPatch(item.contractItemId, {
                                    discountMode: Number(
                                      value,
                                    ) as ContractItemDiscountMode,
                                    discountPercent: 0,
                                    fixedDiscountAmount: 0,
                                  })
                                }
                              >
                                <SelectTrigger className="w-full">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem
                                    value={String(
                                      ContractItemDiscountMode.None,
                                    )}
                                  >
                                    Không chiết khấu
                                  </SelectItem>
                                  <SelectItem
                                    value={String(
                                      ContractItemDiscountMode.Percentage,
                                    )}
                                  >
                                    Theo phần trăm
                                  </SelectItem>
                                  <SelectItem
                                    value={String(
                                      ContractItemDiscountMode.FixedAmount,
                                    )}
                                  >
                                    Số tiền cố định
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {item.discountMode !==
                              ContractItemDiscountMode.Percentage &&
                              item.discountMode !==
                                ContractItemDiscountMode.FixedAmount && (
                                <div className="space-y-1.5">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    Số tiền giảm
                                  </span>
                                  <Input disabled defaultValue={0} />
                                </div>
                              )}

                            {item.discountMode ===
                              ContractItemDiscountMode.Percentage && (
                              <div className="space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Số tiền giảm (%)
                                </span>
                                <DecimalInput
                                  min={0}
                                  max={100}
                                  value={item.discountPercent}
                                  onValueChange={(value) =>
                                    handleItemChange(
                                      item.contractItemId,
                                      "discountPercent",
                                      value,
                                    )
                                  }
                                />
                              </div>
                            )}

                            {item.discountMode ===
                              ContractItemDiscountMode.FixedAmount && (
                              <div className="space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Số tiền giảm ({contract.currencyCode})
                                </span>
                                <DecimalInput
                                  min={0}
                                  value={item.fixedDiscountAmount}
                                  onValueChange={(value) =>
                                    handleItemChange(
                                      item.contractItemId,
                                      "fixedDiscountAmount",
                                      value,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="space-y-1.5">
                              <span className="text-xs font-medium text-muted-foreground">
                                Thuế VAT
                              </span>
                              <div className="flex h-9 items-center justify-between rounded-md border px-3">
                                <span className="text-sm">
                                  {item.isTaxable ? "Có thuế" : "Không thuế"}
                                </span>
                                <Switch
                                  checked={item.isTaxable}
                                  onCheckedChange={(checked) =>
                                    handleItemPatch(item.contractItemId, {
                                      isTaxable: checked,
                                      vatPercent: checked
                                        ? item.vatPercent || 10
                                        : 0,
                                    })
                                  }
                                />
                              </div>
                            </div>

                            {item.isTaxable && (
                              <div className="space-y-1.5">
                                <span className="text-xs font-medium text-muted-foreground">
                                  Thuế suất (%)
                                </span>
                                <DecimalInput
                                  min={0}
                                  max={100}
                                  value={item.vatPercent}
                                  onValueChange={(value) =>
                                    handleItemChange(
                                      item.contractItemId,
                                      "vatPercent",
                                      value,
                                    )
                                  }
                                />
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="grid gap-3 p-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                          <div>
                            <p className="text-muted-foreground">Số lượng</p>
                            <p className="mt-1 font-medium">
                              {item.quantity} {item.unitName}
                            </p>
                            {contract.languageMode ===
                              ContractLanguageMode.Bilingual &&
                              item.unitNameEn && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {item.unitNameEn}
                                </p>
                              )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Đơn giá</p>
                            <p className="mt-1 font-medium">
                              {formatCurrency(
                                item.unitPrice,
                                contract.currencyCode,
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Chiết khấu</p>
                            <p className="mt-1 font-medium">
                              {item.discountMode ===
                              ContractItemDiscountMode.Percentage
                                ? `${item.discountPercent}%`
                                : item.discountMode ===
                                    ContractItemDiscountMode.FixedAmount
                                  ? formatCurrency(
                                      item.fixedDiscountAmount,
                                      contract.currencyCode,
                                    )
                                  : "Không"}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">VAT</p>
                            <p className="mt-1 font-medium">
                              {item.isTaxable
                                ? `${item.vatPercent}%`
                                : "Không thuế"}
                            </p>
                          </div>
                          {contract.languageMode ===
                            ContractLanguageMode.Bilingual && (
                            <div className="sm:col-span-2 xl:col-span-4">
                              <p className="text-muted-foreground">
                                Tên tiếng Anh
                              </p>
                              <p className="mt-1 font-medium">
                                {item.itemNameEn || "Chưa cập nhật"}
                              </p>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="grid gap-3 border-t bg-muted/20 px-4 py-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <div className="flex justify-between gap-3 xl:block">
                          <span className="text-muted-foreground">
                            Tạm tính
                          </span>
                          <p className="font-medium">
                            {formatCurrency(
                              amounts.lineSubtotal,
                              contract.currencyCode,
                            )}
                          </p>
                        </div>
                        <div className="flex justify-between gap-3 xl:block">
                          <span className="text-muted-foreground">
                            Chiết khấu
                          </span>
                          <p className="font-medium text-emerald-600">
                            -
                            {formatCurrency(
                              amounts.discountAmount,
                              contract.currencyCode,
                            )}
                          </p>
                        </div>
                        <div className="flex justify-between gap-3 xl:block">
                          <span className="text-muted-foreground">VAT</span>
                          <p className="font-medium">
                            {formatCurrency(
                              amounts.vatAmount,
                              contract.currencyCode,
                            )}
                          </p>
                        </div>
                        <div className="flex justify-between gap-3 xl:block">
                          <span className="text-muted-foreground">
                            Thành tiền
                          </span>
                          <p className="font-semibold text-primary">
                            {formatCurrency(
                              amounts.lineTotal,
                              contract.currencyCode,
                            )}
                          </p>
                        </div>
                      </div>
                      </div>
                    </div>
                  );
                })}

                {itemsTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItemsCurrentPage((p) => Math.max(1, p - 1))
                      }
                      disabled={itemsCurrentPage === 1}
                    >
                      <ChevronLeft className="size-4 mr-1" /> Trước
                    </Button>
                    <span className="text-sm font-medium">
                      Trang {itemsCurrentPage} / {itemsTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setItemsCurrentPage((p) =>
                          Math.min(itemsTotalPages, p + 1),
                        )
                      }
                      disabled={itemsCurrentPage === itemsTotalPages}
                    >
                      Sau <ChevronRight className="size-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <div className="min-w-0 space-y-6 xl:sticky xl:top-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base">Giá trị hợp đồng</CardTitle>
            <Badge
              variant={hasUnsavedFinancialChanges ? "secondary" : "outline"}
            >
              Phiên bản {contract.currentVersion.versionNo}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {hasUnsavedFinancialChanges && (
              <p className="rounded-lg bg-muted/20 px-3 py-2 text-xs leading-5 text-muted-foreground">
                Đang hiển thị số liệu dự kiến theo các thay đổi trên màn hình.
                Tổng đã lưu:{" "}
                {formatCurrency(
                  persistedFinancialTotals.totalPayment,
                  contract.currencyCode,
                )}
              </p>
            )}
            {isEditable && (
              <div className="space-y-1.5 pb-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Đồng tiền
                </span>
                <Select
                  value={contract.currencyCode}
                  onValueChange={(value) =>
                    handleRootChange("currencyCode", value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VND">VND — Việt Nam đồng</SelectItem>
                    <SelectItem value="USD">USD — Đô la Mỹ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Tạm tính</span>
              <span>
                {formatCurrency(
                  financialTotals.subtotal,
                  contract.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">Chiết khấu</span>
              <span className="text-emerald-600">
                -
                {formatCurrency(
                  financialTotals.totalDiscount,
                  contract.currencyCode,
                )}
              </span>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <span className="text-muted-foreground">VAT</span>
              <span>
                {formatCurrency(
                  financialTotals.totalVat,
                  contract.currencyCode,
                )}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between gap-3">
              <span className="font-medium">Tổng thanh toán</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(
                  financialTotals.totalPayment,
                  contract.currencyCode,
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle className="text-base">Thanh toán</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Tiến độ thanh toán</span>
              <span className="font-semibold">0%</span>
            </div>
            <Progress value={0} className="h-2" />
            <p className="mt-3 text-sm text-muted-foreground">
              Điều kiện đóng hợp đồng yêu cầu khách thanh toán đủ 100%.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bản cứng</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Truck className="size-5" />
            </div>
            <div>
              <p className="font-semibold">Chưa nhận</p>
              <p className="text-sm text-muted-foreground">
                Theo dõi gửi/nhận bản cứng với đối tác.
              </p>
            </div>
          </CardContent>
        </Card> */}
      </div>
    </div>
  );
}
