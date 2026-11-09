"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Package,
  Save,
  CircleAlert,
  ListChecks,
  Settings2,
  Users,
  WalletCards,
  Loader2,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Plus,
  Search,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format-date";

// Các import UI component
import { CreateContractAppendicesEditor } from "@/components/contracts/create-contract-appendices-editor";
import {
  createAppendixFromTemplate,
  getAppendixDraftError,
  toCreateAppendixRequest,
  type CreateAppendixDraft,
} from "@/lib/contract-appendix-draft";
import { Header } from "@/components/ui/custom/header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { DateRangeFilter } from "@/components/ui/custom/date-range-filter";
import { DecimalInput } from "@/components/ui/custom/decimal-input";
import { IntegerInput } from "@/components/ui/custom/integer-input";
import { ConfirmDialog } from "@/components/ui/custom/confirm-dialog";
import { format } from "date-fns";
import { CustomerFormModal } from "@/app/(protected)/customers/customer-form-modal";
import { ProductFormModal } from "@/components/catalog/product-form-modal";
import { ServiceFormModal } from "@/components/catalog/service-form-modal";
import {
  CreateContractTermsEditor,
  type CreateContractTermDraft,
} from "@/components/contracts/create-contract-terms-editor";

import {
  ContractType,
  ContractDirection,
  getContractCounterpartyLabel,
  getContractDirectionLabel,
  ContractLanguageMode,
  ContractItemType,
  ContractItemDiscountMode,
  CreateContractRequest,
  CreateContractItemRequest,
  CreateContractTermRequest,
  type ContractPaymentMilestoneDraft,
  CreateContractResponse,
  EligibleParentContractResponse,
  contractApi,
  getContractTypeLabel,
  getContractLanguageModeLabel,
} from "@/services/contract-api";
import {
  calculateContractItemAmounts,
  calculateContractTotals,
  allocateContractPaymentAmounts,
} from "@/lib/contract-finance";
import { getPaymentDraftError } from "@/lib/contract-payment-draft";
import {
  customerApi,
  CustomerResponse,
  type CustomerLookupResponse,
  CustomerStatus,
} from "@/services/customers-api";
import {
  employeeApi,
  type EmployeeDirectoryResponse,
} from "@/services/employees-api";
import type { ProductResponse } from "@/services/catalog/products-api";
import type { ServiceResponse } from "@/services/catalog/services-api";
import {
  catalogPickerApi,
  type CatalogPickerItem,
} from "@/services/catalog/picker-api";
import {
  contractTemplateApi,
  ContractTermKind,
  PaymentDayCountMode,
  PaymentDueAnchor,
  TemplateDocumentType,
  type AvailableContractTemplateVersionResponse,
  type ContractTemplatePaymentMilestoneResponse,
  type ContractTemplateAppendixResponse,
} from "@/services/contract-template-api";
import { useAuthStore } from "@/hooks/use-auth-store";
import { usePermission } from "@/hooks/use-permission";
import { RBAC_PERMISSIONS } from "@/lib/rbac";
import axiosClient from "@/lib/axios-interceptor";
import type { EditorStored } from "@/hooks/use-editor-server-draft";
import { PdfThumbnail } from "@/components/contracts/document-pdf-preview";
import { WordCatalogImportDialog, type WordCatalogSelection } from "@/components/contracts/word-catalog-import-dialog";
import { WordTermImportDialog } from "@/components/contracts/word-term-import-dialog";
import { termPreviewText, type WordTerm } from "@/lib/word-term-import";
import { parseWordNumber, type WordItemRow } from "@/lib/word-catalog-import";
import { ContractDraftWordPreview } from "@/components/contracts/contract-draft-word-preview";
import { ContractLookupPicker } from "@/components/contracts/contract-lookup-picker";
import { PermissionGuard } from "@/components/auth/permission-guard";

const steps = [
  { id: 0, title: "Thông tin", description: "Đối tác, phụ trách và thời hạn" },
  { id: 1, title: "Rà soát", description: "Sản phẩm, điều khoản và thanh toán" },
  { id: 3, title: "Xem và lưu", description: "Đối chiếu tài liệu, sau đó lưu nháp" },
];

type CatalogItem = {
  wordSource?: WordItemRow;
  id: string; // "p-{id}" or "s-{id}"
  originalId: number;
  itemName: string;
  itemNameEn: string;
  unitName: string;
  unitNameEn: string;
  itemType: ContractItemType;
  unitPrice: number;
  quantity: number;
  discountMode: ContractItemDiscountMode;
  discountPercent: number;
  fixedDiscountAmount: number;
  isTaxable: boolean;
  vatPercent: number;
};

type CustomerOption = CustomerLookupResponse;
type EmployeeOption = EmployeeDirectoryResponse;
type WizardIssue = { field: string; target: string; message: string; itemId?: string };

type AvailableTemplateView = AvailableContractTemplateVersionResponse & {
  versionId: number;
  name: string;
  version: string;
  description: string;
  contractType: ContractType;
};

const getContractTypeFromTemplateDocument = (
  documentType: TemplateDocumentType,
): ContractType | null => {
  switch (documentType) {
    case TemplateDocumentType.SoftwareSupplyContract:
      return ContractType.SoftwareSupply;
    case TemplateDocumentType.SoftwareMaintenanceContract:
      return ContractType.SoftwareMaintenance;
    case TemplateDocumentType.SoftwareUpkeepContract:
      return ContractType.SoftwareUpkeep;
    default:
      return null;
  }
};

const getTemplateDocumentFromContractType = (
  contractType: ContractType,
): TemplateDocumentType => {
  switch (contractType) {
    case ContractType.SoftwareMaintenance:
      return TemplateDocumentType.SoftwareMaintenanceContract;
    case ContractType.SoftwareUpkeep:
      return TemplateDocumentType.SoftwareUpkeepContract;
    default:
      return TemplateDocumentType.SoftwareSupplyContract;
  }
};

const mapPickerItemToCatalogItem = (item: CatalogPickerItem): CatalogItem => ({
  id: `${item.itemType === ContractItemType.Product ? "p" : "s"}-${item.sourceId}`,
  originalId: item.sourceId,
  itemName:
    item.name ||
    (item.itemType === ContractItemType.Product
      ? "Sản phẩm không tên"
      : "Dịch vụ không tên"),
  itemNameEn: item.nameEn ?? "",
  unitName: item.unitName ?? "",
  unitNameEn: item.unitNameEn ?? "",
  itemType: item.itemType,
  unitPrice: item.price || 0,
  quantity: 1,
  discountMode: ContractItemDiscountMode.None,
  discountPercent: 0,
  fixedDiscountAmount: 0,
  isTaxable: true,
  vatPercent: 10,
});

const mapProductToCatalogItem = (product: ProductResponse): CatalogItem =>
  mapPickerItemToCatalogItem({
    sourceId: product.productId,
    itemType: ContractItemType.Product,
    name: product.productName ?? null,
    nameEn: product.productNameEn ?? null,
    unitName: product.unitName,
    unitNameEn: product.unitNameEn,
    price: product.productPrice ?? null,
  });

const mapServiceToCatalogItem = (service: ServiceResponse): CatalogItem =>
  mapPickerItemToCatalogItem({
    sourceId: service.serviceId,
    itemType: ContractItemType.Service,
    name: service.serviceName ?? null,
    nameEn: service.serviceNameEn,
    unitName: service.unitName,
    unitNameEn: service.unitNameEn,
    price: service.servicePrice ?? null,
  });

const contractTypeOptions = [
  ContractType.SoftwareSupply,
  ContractType.SoftwareMaintenance,
  ContractType.SoftwareUpkeep,
];

const formatCurrency = (amount: number, currencyCode: string) => {
  const currency = currencyCode.trim().toUpperCase() || "VND";
  return new Intl.NumberFormat(currency === "VND" ? "vi-VN" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(amount);
};

const getPaymentAnchorLabel = (anchor: PaymentDueAnchor) => {
  switch (anchor) {
    case PaymentDueAnchor.ContractSigned:
      return "ngày ký hợp đồng";
    case PaymentDueAnchor.ContractEffectiveDate:
      return "ngày hợp đồng có hiệu lực";
    case PaymentDueAnchor.AcceptanceCompleted:
      return "ngày hoàn tất nghiệm thu";
    case PaymentDueAnchor.PreviousMilestonePaid:
      return "ngày thanh toán đủ đợt trước";
    case PaymentDueAnchor.ManualDate:
      return "Lịch thủ công";
    default:
      return "mốc chưa xác định";
  }
};

const parseDateString = (str?: string) => {
  if (!str) return undefined;
  const [y, m, d] = str.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

function PaymentPlanReview({
  milestones,
  currencyCode,
}: {
  milestones: Array<ContractPaymentMilestoneDraft & { amount: number }>;
  currencyCode: string;
}) {
  if (!milestones.length) return null;
  const total =
    Math.round(
      milestones.reduce((sum, row) => sum + row.paymentPercent, 0) * 10000,
    ) / 10000;
  return (
    <div className="space-y-3 rounded-2xl border bg-muted/20 p-4">
      <p className="font-semibold">
        Theo dõi các đợt thanh toán · Tổng {total}%
      </p>
      <p className="text-sm text-muted-foreground">
        Có thể sửa kế hoạch ở bước điều khoản. Số tiền được tính theo giá trị
        hợp đồng hiện tại.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {milestones.map((row, index) => (
          <div
            key={index}
            className="space-y-1 rounded-lg border bg-background p-3 text-sm"
          >
            <div className="flex justify-between gap-2">
              <b>{row.titleVi}</b>
              <Badge variant="secondary">{row.paymentPercent}%</Badge>
            </div>
            <p className="font-semibold text-primary">
              {formatCurrency(row.amount, currencyCode)}
            </p>
            <p className="text-muted-foreground">
              Trong {row.dueOffsetDays} ngày kể từ{" "}
              {getPaymentAnchorLabel(row.dueAnchor)}
              {row.dueAnchor === PaymentDueAnchor.ManualDate && row.anchorDate
                ? ` · ${formatDate(row.anchorDate)}`
                : ""}
            </p>
            {row.conditionVi && <p>{row.conditionVi}</p>}
            {row.dayCountMode === PaymentDayCountMode.BusinessDays && (
              <p className="text-xs text-muted-foreground">
                Ngày làm việc chỉ loại trừ thứ Bảy và Chủ nhật.
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-right font-semibold">
        Tổng cộng:{" "}
        {formatCurrency(
          milestones.reduce((sum, row) => sum + row.amount, 0),
          currencyCode,
        )}
      </p>
    </div>
  );
}

function CreateContractFromWordWizard() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const { can } = usePermission();
  const canManageCustomers = can(RBAC_PERMISSIONS.customerManage);
  const canManageCatalog = can(RBAC_PERMISSIONS.catalogManage);

  // -- STATES --
  const [currentStep, setCurrentStep] = useState(0);
  const [attemptedStep, setAttemptedStep] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [customerLookupError, setCustomerLookupError] = useState("");
  const [employeeLookupError, setEmployeeLookupError] = useState("");
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const wizardScrollRef = useRef<HTMLDivElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editorSource, setEditorSource] = useState<EditorStored | null>(null);
  const [editorSourceError, setEditorSourceError] = useState("");
  const [editorSourceLoading, setEditorSourceLoading] = useState(true);
  const [editorSourceReviewed, setEditorSourceReviewed] = useState(false);
  const [useExistingFramework, setUseExistingFramework] = useState(false);
  const [createdContract, setCreatedContract] =
    useState<CreateContractResponse | null>(null);
  const [isOpeningPreview, setIsOpeningPreview] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [responsibleEmployeeId, setResponsibleEmployeeId] =
    useState<string>("");

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);

  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [debouncedEmployeeSearch, setDebouncedEmployeeSearch] = useState("");

  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogResultIds, setCatalogResultIds] = useState<string[]>([]);
  const [catalogTotalCount, setCatalogTotalCount] = useState(0);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [visibleErrorItemId, setVisibleErrorItemId] = useState<string | null>(
    null,
  );
  const [pendingCatalogFocus, setPendingCatalogFocus] = useState<string | null>(
    null,
  );
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [wordImportOpen, setWordImportOpen] = useState(false);
  const [wordTermsOpen, setWordTermsOpen] = useState(false);
  const [wordCatalogExpanded, setWordCatalogExpanded] = useState(false);
  const [wordSettingsExpanded, setWordSettingsExpanded] = useState(true);
  const [pendingSettingsChange, setPendingSettingsChange] = useState<(() => void) | null>(null);
  const [wordAppendicesExpanded, setWordAppendicesExpanded] = useState(false);
  const [wordPreviewDetails, setWordPreviewDetails] = useState(false);
  const [wordQuickPick, setWordQuickPick] = useState<((item: CatalogPickerItem) => void) | null>(null);
  const [availableTemplates, setAvailableTemplates] = useState<
    AvailableTemplateView[]
  >([]);
  const [templateTotalCount, setTemplateTotalCount] = useState(0);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [debouncedTemplateSearch, setDebouncedTemplateSearch] = useState("");
  const [selectedTemplateSnapshot, setSelectedTemplateSnapshot] =
    useState<AvailableTemplateView | null>(null);
  const [contractTerms, setContractTerms] = useState<CreateContractTermDraft[]>(
    [],
  );
  const paymentMilestones = useMemo(
    () =>
      contractTerms.flatMap((term) =>
        term.termKind === ContractTermKind.Payment
          ? term.paymentMilestones
          : [],
      ),
    [contractTerms],
  );
  const [templateAppendices, setTemplateAppendices] = useState<
    ContractTemplateAppendixResponse[]
  >([]);
  const [contractAppendices, setContractAppendices] = useState<
    CreateAppendixDraft[]
  >([]);
  const [hasPendingAppendixForm, setHasPendingAppendixForm] = useState(false);
  const [isLoadingTemplateDetail, setIsLoadingTemplateDetail] = useState(false);
  const [templateDetailError, setTemplateDetailError] = useState<string | null>(
    null,
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const scrollToAndFocus = (elementId: string) => {
    setTimeout(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "instant" });
        if (el.tabIndex >= 0 || el.hasAttribute("tabindex")) el.focus({ preventScroll: true });
        else el.querySelector<HTMLElement>("button:not(:disabled), input:not(:disabled)")?.focus({ preventScroll: true });
      }
    }, 150);
  };

  const ensureCatalogItemVisible = (itemId: string, elementId: string) => {
    setItemFilter("all");
    setCatalogSearch("");
    setVisibleErrorItemId(itemId);
    setPendingCatalogFocus(elementId);
    setCatalogPage(1);
  };

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedCustomerSearch(customerSearch.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [customerSearch]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingCustomers(true);
    setCustomerLookupError("");
    customerApi
      .lookup(debouncedCustomerSearch || undefined)
      .then((result) => {
        if (!cancelled) {
          const activeCustomers = result.filter(
            (customer) => customer.status === CustomerStatus.Active,
          );
          setCustomers((current) => {
            const selected = current.find(
              (customer) => customer.customerId === Number(customerId),
            );
            return selected &&
              !activeCustomers.some(
                (customer) => customer.customerId === selected.customerId,
              )
              ? [selected, ...activeCustomers]
              : activeCustomers;
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load customer lookup:", error);
          setCustomerLookupError("Không tải được danh sách. Thử tìm lại theo tên hoặc mã.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingCustomers(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, debouncedCustomerSearch]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedEmployeeSearch(employeeSearch.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [employeeSearch]);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingEmployees(true);
    setEmployeeLookupError("");
    employeeApi
      .searchDirectory({
        page: 1,
        pageSize: 50,
        keyword: debouncedEmployeeSearch || undefined,
      })
      .then((result) => {
        if (!cancelled) {
          setEmployees((current) => {
            const selected = current.find(
              (employee) =>
                employee.employeeId === Number(responsibleEmployeeId),
            );
            return selected &&
              !result.items.some(
                (employee) => employee.employeeId === selected.employeeId,
              )
              ? [selected, ...result.items]
              : result.items;
          });
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load employee directory:", error);
          setEmployeeLookupError("Không tải được danh sách. Thử tìm lại theo tên hoặc mã.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEmployees(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedEmployeeSearch, responsibleEmployeeId]);

  // Step 1: Customer & Basic Info
  const handleCustomerCreated = (createdCustomer?: CustomerResponse) => {
    if (!createdCustomer) return;

    setCustomers((currentCustomers) => [
      createdCustomer,
      ...currentCustomers.filter(
        (customer) => customer.customerId !== createdCustomer.customerId,
      ),
    ]);
    setCustomerId(String(createdCustomer.customerId));
    setParentContractId("");
    clearFieldError("customerId");
  };

  const handleAssignToMe = () => {
    if (!user?.employeeId) return;
    setResponsibleEmployeeId(String(user.employeeId));
    clearFieldError("responsibleEmployeeId");
  };
  const [contractDirection, setContractDirection] =
    useState<ContractDirection | null>(null);
  const counterpartyLabel =
    contractDirection === null
      ? "Đối tác"
      : getContractCounterpartyLabel(contractDirection);
  const [contractType, setContractType] = useState<ContractType>(
    ContractType.SoftwareSupply,
  );
  const [parentContractId, setParentContractId] = useState<string>("");
  const [eligibleParents, setEligibleParents] = useState<
    EligibleParentContractResponse[]
  >([]);
  const [isLoadingEligibleParents, setIsLoadingEligibleParents] =
    useState<boolean>(false);
  const [templateVersionId, setTemplateVersionId] = useState<string>("");
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const templatePageSize = 3;
  const wordOnly = !useExistingFramework;
  const templateDisplayName = wordOnly ? editorSource?.title : undefined;
  const [languageMode, setLanguageMode] = useState<ContractLanguageMode | null>(
    null,
  );
  const [currencyCode, setCurrencyCode] = useState("VND");
  const [contractTitle, setContractTitle] = useState("");
  const [contractTitleEn, setContractTitleEn] = useState("");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("editorDocument");
    const revision = Number(params.get("editorRevision"));
    if (!id || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || !Number.isSafeInteger(revision) || revision < 1) {
      setEditorSourceError("Cần mở bản Word đã lưu và bấm Tạo hợp đồng từ tài liệu này.");
      setEditorSourceLoading(false);
      return;
    }
    let cancelled = false;
    const abort = new AbortController();
    void axiosClient.get<unknown, EditorStored>(`/api/contract-editor-drafts/${id}`, { params: { revision }, signal: abort.signal }).then(source => {
      if (cancelled) return;
      if (source.revision !== revision || source.currentRevision !== revision) throw new Error("Tài liệu đã thay đổi phiên bản. Mở lại tài liệu để tạo Draft từ bản mới nhất.");
      if (source.isTemplate) throw new Error("Hãy bấm Dùng mẫu, lưu bản sao rồi tạo hợp đồng từ bản sao đó.");
      setEditorSource(source); setContractType(ContractType.SoftwareSupply); setParentContractId("");
      setContractTitle(source.bindings.CONTRACT_NAME || source.title);
      if (source.bindings.SOURCE_CUSTOMER_ID) setCustomerId(source.bindings.SOURCE_CUSTOMER_ID);
      if (source.bindings.SOURCE_EMPLOYEE_ID) setResponsibleEmployeeId(source.bindings.SOURCE_EMPLOYEE_ID);
      if (source.bindings.CUSTOMER_NAME) setCustomerSearch(source.bindings.CUSTOMER_NAME);
      if (source.bindings.EMPLOYEE_NAME) setEmployeeSearch(source.bindings.EMPLOYEE_NAME);
    }).catch(error => { if (!cancelled) setEditorSourceError(error instanceof Error ? error.message : "Không mở được tài liệu nguồn."); }).finally(() => { if (!cancelled) setEditorSourceLoading(false); });
    return () => { cancelled = true; abort.abort(); };
  }, []);

  const templateTotalPages = Math.max(
    1,
    Math.ceil(templateTotalCount / templatePageSize),
  );
  const paginatedTemplates = availableTemplates;

  useEffect(() => {
    const timer = window.setTimeout(
      () => setDebouncedTemplateSearch(templateSearch.trim()),
      350,
    );
    return () => window.clearTimeout(timer);
  }, [templateSearch]);

  useEffect(() => {
    if (wordOnly || languageMode === null || contractDirection === null) {
      setAvailableTemplates([]);
      setTemplateTotalCount(0);
      setIsLoadingTemplates(false);
      return;
    }
    let cancelled = false;
    setIsLoadingTemplates(true);
    contractTemplateApi
      .searchAvailable({
        page: templatePage,
        pageSize: templatePageSize,
        keyword: debouncedTemplateSearch || undefined,
        documentType: getTemplateDocumentFromContractType(contractType),
        languageMode,
        contractDirection,
      })
      .then((response) => {
        if (cancelled) return;
        const mapped = response.items.flatMap((template) => {
          const mappedContractType = getContractTypeFromTemplateDocument(
            template.documentType,
          );
          return mappedContractType === null
            ? []
            : [
                {
                  ...template,
                  versionId: template.templateVersionId,
                  name: template.templateName,
                  version: String(template.versionNo),
                  description: `Phiên bản ${template.versionNo}`,
                  contractType: mappedContractType,
                },
              ];
        });
        setAvailableTemplates(mapped);
        setTemplateTotalCount(response.totalCount);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load available templates:", error);
          setAvailableTemplates([]);
          setTemplateTotalCount(0);
          toast.error("Không thể tải danh sách mẫu hợp đồng.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    contractType,
    languageMode,
    contractDirection,
    debouncedTemplateSearch,
    templatePage,
    wordOnly,
  ]);

  useEffect(() => {
    if (!templateVersionId) {
      setIsLoadingTemplateDetail(false);
      setTemplateAppendices([]);
      setTemplateDetailError(null);
      return;
    }

    let cancelled = false;
    setIsLoadingTemplateDetail(true);
    setTemplateDetailError(null);
    setContractTerms([]);

    setTemplateAppendices([]);
    setContractAppendices([]);
    setHasPendingAppendixForm(false);

    contractTemplateApi
      .getAvailableByVersionId(Number(templateVersionId))
      .then((detail) => {
        if (cancelled) return;
        if (
          detail.contractDirection !== contractDirection ||
          detail.languageMode !== languageMode
        )
          throw new Error(
            "Mẫu không khớp chiều giao dịch hoặc ngôn ngữ đang chọn.",
          );
        if (!cancelled) {
          setContractTerms(
            [...detail.terms]
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map((term, index) => ({
                clientId: `template-${term.templateTermId}`,
                sourceTemplateTermId: term.templateTermId,
                termKind: term.termKind,
                paymentMilestones: term.paymentMilestones.map((row) => ({
                  ...row,
                  sourceTemplatePaymentMilestoneId:
                    row.templatePaymentMilestoneId,
                  anchorDate: null,
                })),
                termCode: term.termCode,
                termTitle: term.termTitle,
                termTitleEn: term.termTitleEn,
                termContent: term.termContent,
                termContentEn: term.termContentEn,
                bilingualContentMode: term.bilingualContentMode,
                isNegotiable: term.isNegotiable,
                displayOrder: index + 1,
              })),
          );
          const appendices = [...detail.appendices].sort(
            (a, b) => a.displayOrder - b.displayOrder,
          );
          setTemplateAppendices(appendices);
          setContractAppendices(
            appendices
              .filter(
                (appendix) =>
                  appendix.isRequired || appendix.isSelectedByDefault,
              )
              .map(createAppendixFromTemplate),
          );
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load template terms:", error);
          setContractTerms([]);

          setTemplateAppendices([]);
          setContractAppendices([]);
          setHasPendingAppendixForm(false);

          setTemplateDetailError("Không thể tải điều khoản của mẫu hợp đồng.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingTemplateDetail(false);
      });
    return () => {
      cancelled = true;
    };
  }, [templateVersionId, contractDirection, languageMode]);

  // Keep parent results scoped to the current subject, direction and contract type.
  useEffect(() => {
    let cancelled = false;
    setEligibleParents([]);
    setParentContractId("");
    if (
      contractDirection === null ||
      !customerId ||
      (contractType !== ContractType.SoftwareMaintenance &&
        contractType !== ContractType.SoftwareUpkeep)
    ) {
      setIsLoadingEligibleParents(false);
      return;
    }
    setIsLoadingEligibleParents(true);
    contractApi
      .getEligibleParents({
        customerId: Number(customerId),
        contractDirection,
        targetContractType: contractType,
        page: 1,
        pageSize: 100,
      })
      .then((res) => {
        if (!cancelled) setEligibleParents(res.items || []);
      })
      .catch(() => {
        if (!cancelled)
          toast.error("Không thể tải hợp đồng nguồn của đối tác.");
      })
      .finally(() => {
        if (!cancelled) setIsLoadingEligibleParents(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, contractType, contractDirection]);

  // Step 2: Items, Filter & Pagination
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [itemFilter, setItemFilter] = useState<
    "all" | "product" | "service" | "selected"
  >("all");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [debouncedCatalogSearch, setDebouncedCatalogSearch] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [catalogRevision, setCatalogRevision] = useState(0);
  const catalogPageSize = 5;
  const selectedCatalogFilter = useMemo(
    () =>
      itemFilter === "selected"
        ? {
            productIds: selectedItems
              .filter((id) => id.startsWith("p-"))
              .map((id) => Number(id.slice(2))),
            serviceIds: selectedItems
              .filter((id) => id.startsWith("s-"))
              .map((id) => Number(id.slice(2))),
          }
        : null,
    [itemFilter, selectedItems],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedCatalogSearch(catalogSearch.trim());
    }, 400);

    return () => window.clearTimeout(timeoutId);
  }, [catalogSearch]);

  useEffect(() => {
    let isCancelled = false;
    const abortController = new AbortController();

    const fetchCatalogItems = async () => {
      setIsLoadingCatalog(true);
      setCatalogResultIds([]);

      try {
        const response = await catalogPickerApi.search(
          {
            page: catalogPage,
            pageSize: catalogPageSize,
            keyword: debouncedCatalogSearch || undefined,
            itemType:
              itemFilter === "product"
                ? ContractItemType.Product
                : itemFilter === "service"
                  ? ContractItemType.Service
                  : undefined,
            selectedOnly: selectedCatalogFilter !== null,
            ...(selectedCatalogFilter ?? {}),
            focusItemType: visibleErrorItemId
              ? visibleErrorItemId.startsWith("p-")
                ? ContractItemType.Product
                : ContractItemType.Service
              : undefined,
            focusItemId: visibleErrorItemId
              ? Number(visibleErrorItemId.slice(2))
              : undefined,
          },
          abortController.signal,
        );
        const fetchedItems = response.items.map(mapPickerItemToCatalogItem);

        if (isCancelled) return;

        setCatalogItems((currentItems) => {
          const currentById = new Map(
            currentItems.map((item) => [item.id, item]),
          );
          const fetchedIds = new Set(fetchedItems.map((item) => item.id));
          const mergedFetchedItems = fetchedItems.map((item) => ({
            ...(currentById.get(item.id) ?? item),
            itemNameEn: item.itemNameEn,
            unitName: item.unitName,
            unitNameEn: item.unitNameEn,
          }));

          return [
            ...mergedFetchedItems,
            ...currentItems.filter((item) => !fetchedIds.has(item.id)),
          ];
        });
        setCatalogResultIds(fetchedItems.map((item) => item.id));
        setCatalogTotalCount(response.totalCount);
      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to fetch catalog items:", error);
          toast.error("Không thể tải danh sách sản phẩm và dịch vụ.");
        }
      } finally {
        if (!isCancelled) setIsLoadingCatalog(false);
      }
    };

    void fetchCatalogItems();

    return () => {
      isCancelled = true;
      abortController.abort();
    };
  }, [
    debouncedCatalogSearch,
    itemFilter,
    catalogPage,
    selectedCatalogFilter,
    visibleErrorItemId,
    catalogRevision,
  ]);

  const handleProductCreated = (createdProduct?: ProductResponse) => {
    if (!createdProduct) return;
    if (wordQuickPick) {
      wordQuickPick({ sourceId: createdProduct.productId, itemType: ContractItemType.Product, code: createdProduct.productCode,
        name: createdProduct.productName ?? null, nameEn: createdProduct.productNameEn ?? null, unitName: createdProduct.unitName ?? null,
        unitNameEn: createdProduct.unitNameEn ?? null, price: createdProduct.productPrice ?? null });
      setCatalogRevision(revision => revision + 1);
      return;
    }

    setVisibleErrorItemId(null);
    setPendingCatalogFocus(null);
    const catalogItem = mapProductToCatalogItem(createdProduct);
    setCatalogItems((currentItems) => [
      catalogItem,
      ...currentItems.filter((item) => item.id !== catalogItem.id),
    ]);
    setSelectedItems((currentItems) => [
      catalogItem.id,
      ...currentItems.filter((id) => id !== catalogItem.id),
    ]);
    clearFieldError("selectedItems");
    setCatalogRevision((revision) => revision + 1);
    setCatalogSearch("");
    setItemFilter("product");
    setCatalogPage(1);
  };

  const handleServiceCreated = (createdService?: ServiceResponse) => {
    if (!createdService) return;
    if (wordQuickPick) {
      wordQuickPick({ sourceId: createdService.serviceId, itemType: ContractItemType.Service,
        name: createdService.serviceName ?? null, nameEn: createdService.serviceNameEn ?? null, unitName: createdService.unitName ?? null,
        unitNameEn: createdService.unitNameEn ?? null, price: createdService.servicePrice ?? null });
      setCatalogRevision(revision => revision + 1);
      return;
    }

    setVisibleErrorItemId(null);
    setPendingCatalogFocus(null);
    const catalogItem = mapServiceToCatalogItem(createdService);
    setCatalogItems((currentItems) => [
      catalogItem,
      ...currentItems.filter((item) => item.id !== catalogItem.id),
    ]);
    setSelectedItems((currentItems) => [
      catalogItem.id,
      ...currentItems.filter((id) => id !== catalogItem.id),
    ]);
    clearFieldError("selectedItems");
    setCatalogRevision((revision) => revision + 1);
    setCatalogSearch("");
    setItemFilter("service");
    setCatalogPage(1);
  };

  useEffect(() => {
    setCatalogPage(1);
  }, [catalogSearch, itemFilter]);

  const addItemsFromWord = (rows: WordCatalogSelection[]) => {
    const items = rows.map(({ item, quantity, unitPrice, source }) => ({
      ...mapPickerItemToCatalogItem(item), quantity, unitPrice, wordSource: source, isTaxable: false, vatPercent: 0,
    }));
    const ids = new Set(items.map(item => item.id));
    if (ids.size !== items.length || selectedItems.some(id => ids.has(id))) {
      toast.error("Có mục trùng với danh sách đã chọn. Hãy kiểm tra lại.");
      return;
    }
    setCatalogItems(current => [...current.filter(item => !ids.has(item.id)), ...items]);
    setSelectedItems(current => [...current, ...ids]);
    clearFieldError("selectedItems");
    setItemFilter("selected");
    setCatalogSearch("");
    setCatalogPage(1);
    setEditorSourceReviewed(false);
    setWordImportOpen(false);
    toast.success(`Đã thêm ${items.length} dòng từ Word. Hãy kiểm tra VAT và chiết khấu trước khi tạo hợp đồng.`);
  };

  const closeQuickCatalogModal = (kind: "product" | "service") => {
    if (kind === "product") setIsProductModalOpen(false);
    else setIsServiceModalOpen(false);
    if (wordQuickPick) {
      setWordQuickPick(null);
      setWordImportOpen(true);
    }
  };

  const paginatedCatalog = useMemo(() => {
    const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
    return catalogResultIds.flatMap((id) => {
      const item = catalogById.get(id);
      return item ? [item] : [];
    });
  }, [catalogItems, catalogResultIds]);

  const catalogTotalPages = Math.ceil(catalogTotalCount / catalogPageSize);

  useEffect(() => {
    setCatalogPage((page) => Math.min(page, Math.max(1, catalogTotalPages)));
  }, [catalogTotalPages]);

  useEffect(() => {
    if ((currentStep !== 1 && !(editorSource && currentStep === 2)) || !pendingCatalogFocus) return;
    const element = document.getElementById(pendingCatalogFocus);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus({ preventScroll: true });
    const frame = window.requestAnimationFrame(() =>
      setPendingCatalogFocus(null),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [currentStep, editorSource, paginatedCatalog, pendingCatalogFocus]);

  // Step 3: Terms & Dates
  const [effectiveDate, setEffectiveDate] = useState("");
  const [expiredDate, setExpiredDate] = useState("");
  const hasValidContractDateRange =
    Boolean(effectiveDate && expiredDate) &&
    new Date(effectiveDate).getTime() <= new Date(expiredDate).getTime();
  const contractTermsValidationError = useMemo(() => {
    if (isLoadingTemplateDetail) return "Đang tải điều khoản của mẫu hợp đồng.";
    if (templateDetailError) return templateDetailError;
    if (contractTerms.length === 0) {
      return "Hợp đồng phải có ít nhất một điều khoản.";
    }

    const invalidTerm = contractTerms.find(
      (term) => !term.termCode.trim() || !term.termTitle.trim(),
    );
    if (invalidTerm) {
      return "Mã và tiêu đề điều khoản không được để trống.";
    }

    const codes = new Set<string>();
    for (const term of contractTerms) {
      const code = term.termCode.trim().toUpperCase();
      if (codes.has(code)) return `Mã điều khoản '${code}' bị trùng.`;
      codes.add(code);

      if (
        languageMode === ContractLanguageMode.Bilingual &&
        !term.termTitleEn?.trim()
      ) {
        return `Điều khoản '${code}' phải có tiêu đề tiếng Anh.`;
      }
      if (
        languageMode === ContractLanguageMode.Bilingual &&
        term.termContent?.trim() &&
        term.bilingualContentMode === 1 &&
        !term.termContentEn?.trim()
      ) {
        return `Điều khoản '${code}' phải có nội dung tiếng Anh.`;
      }
    }

    return getPaymentDraftError(
      contractTerms,
      languageMode === ContractLanguageMode.Bilingual,
    );
  }, [
    contractTerms,
    isLoadingTemplateDetail,
    languageMode,
    templateDetailError,
  ]);
  // -- COMPUTED VALUES --
  const appendicesValidationError = hasPendingAppendixForm
    ? "Hãy hoàn tất hoặc hủy phần thêm điều khoản phụ lục trước khi tiếp tục."
    : getAppendixDraftError(
        contractAppendices,
        languageMode === ContractLanguageMode.Bilingual,
      );
  const selectedCustomer = customers.find(
    (item) => item.customerId === Number(customerId),
  );
  const selectedEmployee = employees.find(
    (item) => item.employeeId === Number(responsibleEmployeeId),
  );
  const selectedParentContract = eligibleParents.find(
    (item) => item.contractId === Number(parentContractId),
  );
  const selectedTemplate =
    availableTemplates.find(
      (item) => item.versionId === Number(templateVersionId),
    ) ?? selectedTemplateSnapshot;

  const selectedCatalogItems = catalogItems.filter((item) =>
    selectedItems.includes(item.id),
  );
  const reviewCatalogIssues = selectedCatalogItems.filter(item =>
    !item.unitName.trim() ||
    (languageMode === ContractLanguageMode.Bilingual && (!item.itemNameEn.trim() || !item.unitNameEn.trim())) ||
    (item.wordSource && (parseWordNumber(item.wordSource.quantity) !== item.quantity
      || parseWordNumber(item.wordSource.price, currencyCode) !== item.unitPrice
      || (item.wordSource.total && parseWordNumber(item.wordSource.total, currencyCode) !== calculateContractItemAmounts(item, currencyCode).lineTotal))));
  const changedWordTerms = contractTerms.filter(term => term.wordSource &&
    (term.wordSource.title !== term.termTitle || term.wordSource.content !== (term.termContent ?? "")));
  const showWordSettings = !editorSource || wordSettingsExpanded || contractDirection === null || languageMode === null;

  const financialTotals = useMemo(
    () => calculateContractTotals(selectedCatalogItems, currencyCode),
    [selectedCatalogItems, currencyCode],
  );
  const totalValue = financialTotals.totalPayment;
  const paymentPlan = useMemo(() => {
    const amounts = allocateContractPaymentAmounts(
      totalValue,
      paymentMilestones,
      currencyCode,
    );
    return paymentMilestones.map((row, index) => ({
      ...row,
      amount: amounts[index],
    }));
  }, [currencyCode, paymentMilestones, totalValue]);
  const manualPaymentDatesValid = paymentMilestones
    .filter((item) => item.dueAnchor === PaymentDueAnchor.ManualDate)
    .every((item) => !!item.anchorDate);
  const invalidFinanceItem = selectedCatalogItems.find((item) =>
    item.quantity <= 0 || item.unitPrice < 0 || item.discountPercent < 0 ||
    item.discountPercent > 100 || item.fixedDiscountAmount < 0 ||
    item.fixedDiscountAmount > item.quantity * item.unitPrice ||
    item.vatPercent < 0 || item.vatPercent > 100,
  );

  const addTermsFromWord = (rows: WordTerm[]) => {
    const codes = new Set(contractTerms.map(term => term.termCode.trim().toUpperCase()));
    const additions: CreateContractTermDraft[] = [];
    for (const row of rows) {
      if (codes.has(row.code) || !row.title.trim() || row.title.length > 500) continue;
      codes.add(row.code);
      additions.push({
        clientId: `word-${crypto.randomUUID()}`,
        termKind: ContractTermKind.General,
        termCode: row.code, termTitle: row.title, termContent: row.content,
        wordSource: { title: row.title, content: row.content },
        bilingualContentMode: 1, isNegotiable: true, paymentMilestones: [],
        displayOrder: contractTerms.length + additions.length + 1,
      });
    }
    if (!additions.length) return;
    setContractTerms([...contractTerms, ...additions]);
    clearFieldError("contractTerms");
    setEditorSourceReviewed(false);
    setWordTermsOpen(false);
    toast.success(`Đã lấy ${additions.length} điều khoản từ Word. Hãy rà soát trước khi tiếp tục.`);
  };

  const reviewStep = currentStep === 1 || currentStep === 2;
  const navigation = steps;
  const displayedStepId = reviewStep ? 1 : currentStep;
  const displayedIndex = navigation.findIndex(step => step.id === displayedStepId);
  const setupIssues: WizardIssue[] = [];
  const reviewIssues: WizardIssue[] = [];
  if (!contractTitle.trim()) setupIssues.push({ field: "contractTitle", target: "contract-title-input", message: "Nhập tên hợp đồng." });
  if (!customerId) setupIssues.push({ field: "customerId", target: "contract-customer-id", message: `Chọn ${counterpartyLabel.toLocaleLowerCase("vi")}.` });
  if (!responsibleEmployeeId) setupIssues.push({ field: "responsibleEmployeeId", target: "contract-employee-id", message: "Chọn nhân viên phụ trách." });
  if (contractDirection === null) setupIssues.push({ field: "contractDirection", target: "contract-direction", message: "Chọn hợp đồng mua hay bán." });
  if (languageMode === null) setupIssues.push({ field: "languageMode", target: "contract-language-mode", message: "Chọn ngôn ngữ hợp đồng." });
  if (languageMode === ContractLanguageMode.Bilingual && !contractTitleEn.trim())
    setupIssues.push({ field: "contractTitleEn", target: "contract-title-en-input", message: "Nhập tên hợp đồng tiếng Anh." });
  if (contractType !== ContractType.SoftwareSupply && !parentContractId)
    setupIssues.push({ field: "parentContractId", target: "contract-parent-id", message: "Chọn hợp đồng gốc." });
  if (!wordOnly && (!templateVersionId || selectedTemplate?.contractDirection !== contractDirection || selectedTemplate?.languageMode !== languageMode))
    setupIssues.push({ field: "templateVersionId", target: "contract-template-source", message: "Chọn một khung phù hợp hoặc quay về dùng Word." });
  if (!hasValidContractDateRange) setupIssues.push({
    field: "contractDateRange", target: "contract-date-range-container",
    message: !effectiveDate || !expiredDate ? "Chọn ngày bắt đầu và kết thúc." : "Ngày kết thúc không được trước ngày bắt đầu.",
  });
  if (!selectedCatalogItems.length) reviewIssues.push({ field: "selectedItems", target: "word-catalog-review", message: "Thêm ít nhất một sản phẩm hoặc dịch vụ." });
  const incompleteItem = selectedCatalogItems.find((item) =>
    !item.unitName.trim() || (languageMode === ContractLanguageMode.Bilingual && (!item.unitNameEn.trim() || !item.itemNameEn.trim())),
  );
  if (incompleteItem) reviewIssues.push({
    field: `item-card-${incompleteItem.id}`, itemId: incompleteItem.id, target: `contract-item-card-${incompleteItem.id}`,
    message: `Bổ sung đơn vị tính hoặc thông tin tiếng Anh cho “${incompleteItem.itemName}”.`,
  });
  if (invalidFinanceItem && invalidFinanceItem.id !== incompleteItem?.id) reviewIssues.push({
    field: `item-card-${invalidFinanceItem.id}`, itemId: invalidFinanceItem.id, target: `contract-item-card-${invalidFinanceItem.id}`,
    message: `Kiểm tra số lượng, giá, chiết khấu và VAT của “${invalidFinanceItem.itemName}”.`,
  });
  if (contractTermsValidationError || !manualPaymentDatesValid) reviewIssues.push({
    field: "contractTerms", target: "contract-terms-container",
    message: contractTermsValidationError || "Nhập ngày bắt đầu tính hạn cho đợt thanh toán dùng lịch thủ công.",
  });
  if (appendicesValidationError) reviewIssues.push({
    field: "contractAppendices", target: "contract-appendices-container", message: appendicesValidationError,
  });
  const currentIssues = displayedStepId === 0 ? setupIssues : reviewStep ? reviewIssues :
    editorSourceReviewed ? [] : [{ field: "wordReview", target: "draft-word-review", message: "Xác nhận đã đối chiếu bản Word trước khi lưu." }];

  const moveToStep = (id: number) => {
    if (id === displayedStepId || isSubmitting) return;
    setAttemptedStep(null);
    setSubmitError("");
    setEditorSourceReviewed(false);
    setCurrentStep(id);
    window.requestAnimationFrame(() => {
      wizardScrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
      stepHeadingRef.current?.focus({ preventScroll: true });
    });
  };

  const focusIssue = (issue: WizardIssue) => {
    if (issue.field === "contractDirection" || issue.field === "languageMode") setWordSettingsExpanded(true);
    if (issue.field === "contractAppendices") setWordAppendicesExpanded(true);
    setFieldErrors((previous) => ({ ...previous, [issue.field]: true }));
    if (issue.itemId) {
      setWordCatalogExpanded(true);
      ensureCatalogItemVisible(issue.itemId, issue.target);
    } else scrollToAndFocus(issue.target);
  };

  const advance = () => {
    if (currentIssues.length) {
      setAttemptedStep(displayedStepId);
      focusIssue(currentIssues[0]);
      return;
    }
    if (currentStep === 3) void handleSubmit();
    else moveToStep(currentStep === 0 ? 1 : 3);
  };
  const dateRangeFields = (
    <div
      id="contract-date-range-container"
      className={cn(
        "rounded-2xl border bg-muted/20 p-4 transition-all",
        fieldErrors.contractDateRange &&
          "border-destructive ring-2 ring-destructive/40 bg-destructive/5",
      )}
    >
      <div className="space-y-2">
        <Label className="text-md">
          Thời hạn hiệu lực{" "}
          <span className="text-red-500">*</span>
        </Label>
        <DateRangeFilter
          compact
          confirmOnDaySelect
          buttonClassName={cn(
            "bg-background",
            fieldErrors.contractDateRange &&
              "border-destructive ring-2 ring-destructive/20",
          )}
          dateRange={{
            from: parseDateString(effectiveDate),
            to: parseDateString(expiredDate),
          }}
          onChange={(range) => {
            const nextEff = range.from
              ? format(range.from, "yyyy-MM-dd")
              : "";
            const nextExp = range.to
              ? format(range.to, "yyyy-MM-dd")
              : "";
            setEffectiveDate(nextEff);
            setExpiredDate(nextExp);
            if (
              nextEff &&
              nextExp &&
              new Date(nextEff).getTime() <=
                new Date(nextExp).getTime()
            ) {
              clearFieldError("contractDateRange");
            }
          }}
        />
      </div>
    </div>
  );

  const handleContractTypeChange = (value: string) => {
    const nextType = Number(value) as ContractType;
    setContractType(nextType);
    setParentContractId("");
    clearFieldError("parentContractId");
    setTemplatePage(1);

    if (selectedTemplate?.contractType !== nextType) {
      setTemplateVersionId("");
      setSelectedTemplateSnapshot(null);
    }
  };

  const handleTemplateSelect = (versionId: number) => {
    const template = availableTemplates.find(
      (item) => item.versionId === versionId,
    );
    if (
      !template ||
      template.languageMode !== languageMode ||
      template.contractType !== contractType ||
      template.contractDirection !== contractDirection
    )
      return;

    setTemplateVersionId(String(versionId));
    setSelectedTemplateSnapshot(template);
    clearFieldError("templateVersionId");
  };

  const handleDirectionChange = (value: string) => {
    const next = Number(value) as ContractDirection;
    if (next === contractDirection) return;
    setContractDirection(next);
    clearFieldError("contractDirection");
    setParentContractId("");
    setEligibleParents([]);
    setTemplatePage(1);
    setTemplateVersionId("");
    setSelectedTemplateSnapshot(null);
    setAvailableTemplates([]);
    setTemplateTotalCount(0);
    setTemplateAppendices([]);
    if (!wordOnly) resetReviewContent();
  };

  const handleLanguageModeChange = (value: string) => {
    const nextMode = Number(value) as ContractLanguageMode;
    if (nextMode === languageMode) return;
    if (wordOnly && nextMode === ContractLanguageMode.Vietnamese && (
      contractTerms.some((term) => term.bilingualContentMode === 2) ||
      contractAppendices.some((appendix) => appendix.terms.some((term) => term.bilingualContentMode === 2))
    )) {
      toast.error("Hãy chuyển các mục đang gộp song ngữ sang nội dung tách riêng trước khi đổi sang tiếng Việt.");
      return;
    }
    setLanguageMode(nextMode);
    setTemplatePage(1);
    setTemplateVersionId("");
    setSelectedTemplateSnapshot(null);
    setAvailableTemplates([]);
    setTemplateTotalCount(0);
    setIsLoadingTemplates(true);
    setTemplateAppendices([]);
    if (!wordOnly) resetReviewContent();
    clearFieldError("languageMode");
    clearFieldError("templateVersionId");
  };

  const resetReviewContent = () => {
    setContractTerms([]);
    setContractAppendices([]);
    setHasPendingAppendixForm(false);
  };

  const confirmReviewReset = (change: () => void) => {
    if (contractTerms.length || contractAppendices.length || hasPendingAppendixForm)
      setPendingSettingsChange(() => change);
    else change();
  };

  const toggleCatalogItem = (id: string) => {
    setSelectedItems((prev) => {
      const next = prev.includes(id)
        ? prev.filter((item) => item !== id)
        : [...prev, id];
      if (next.length > 0) {
        clearFieldError("selectedItems");
      }
      return next;
    });
  };

  const updateCatalogItem = (id: string, patch: Partial<CatalogItem>) => {
    setCatalogItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    clearFieldError(`item-card-${id}`);
  };

  const updateQuantity = (id: string, quantity: number) => {
    updateCatalogItem(id, { quantity: Math.max(1, Math.trunc(quantity || 1)) });
  };

  const updateDiscountMode = (
    id: string,
    discountMode: ContractItemDiscountMode,
  ) => {
    updateCatalogItem(id, {
      discountMode,
      discountPercent: 0,
      fixedDiscountAmount: 0,
    });
  };

  // -- SUBMIT ACTION --
  const handleSubmit = async () => {
    if (!editorSource || editorSourceLoading || editorSourceError) { toast.error(editorSourceError || "Chưa có bản Word để tạo hợp đồng."); return; }
    if (!editorSourceReviewed) { toast.error("Cần xác nhận rà soát tài liệu nguồn trước khi tạo Draft."); return; }
    if (contractDirection === null) {
      toast.error("Vui lòng chọn chiều giao dịch Bán hoặc Mua.");
      setCurrentStep(0);
      setFieldErrors({ contractDirection: true });
      scrollToAndFocus("contract-direction");
      return;
    }
    if (languageMode === null) {
      toast.error("Vui lòng chọn ngôn ngữ hợp đồng trước khi chọn mẫu.");
      setCurrentStep(0);
      setFieldErrors({ languageMode: true });
      scrollToAndFocus("contract-language-mode");
      return;
    }
    // 1. Validate Step 0: Đối tác & Mẫu
    if (!customerId) {
      toast.error("Vui lòng chọn khách hàng / đối tác.");
      setCurrentStep(0);
      setFieldErrors({ customerId: true });
      scrollToAndFocus("contract-customer-id");
      return;
    }
    if (!responsibleEmployeeId) {
      toast.error("Vui lòng chọn nhân viên phụ trách.");
      setCurrentStep(0);
      setFieldErrors({ responsibleEmployeeId: true });
      scrollToAndFocus("contract-employee-id");
      return;
    }
    if (
      (contractType === ContractType.SoftwareMaintenance ||
        contractType === ContractType.SoftwareUpkeep) &&
      !parentContractId
    ) {
      toast.error(
        "Vui lòng chọn hợp đồng nguồn (hợp đồng cung cấp phần mềm gốc).",
      );
      setCurrentStep(0);
      setFieldErrors({ parentContractId: true });
      scrollToAndFocus("contract-parent-id");
      return;
    }
    if (!contractTitle.trim()) {
      toast.error("Vui lòng nhập tên hợp đồng.");
      setCurrentStep(0);
      setFieldErrors({ contractTitle: true });
      scrollToAndFocus("contract-title-input");
      return;
    }
    if (
      languageMode === ContractLanguageMode.Bilingual &&
      !contractTitleEn.trim()
    ) {
      toast.error("Hợp đồng song ngữ phải có tên hợp đồng tiếng Anh.");
      setCurrentStep(0);
      setFieldErrors({ contractTitleEn: true });
      scrollToAndFocus("contract-title-en-input");
      return;
    }
    if (!wordOnly && !templateVersionId) {
      toast.error("Vui lòng chọn mẫu hợp đồng.");
      setCurrentStep(0);
      setFieldErrors({ templateVersionId: true });
      scrollToAndFocus("contract-templates-container");
      return;
    }

    // 2. Validate Step 1: Sản phẩm
    if (selectedItems.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 sản phẩm hoặc dịch vụ.");
      setCurrentStep(1);
      setFieldErrors({ selectedItems: true });
      scrollToAndFocus("contract-catalog-container");
      return;
    }
    const missingEnglishItem = selectedCatalogItems.find(
      (item) =>
        languageMode === ContractLanguageMode.Bilingual &&
        !item.itemNameEn.trim(),
    );
    if (missingEnglishItem) {
      toast.error(
        `“${missingEnglishItem.itemName}” thiếu tên tiếng Anh trong danh mục. Hãy cập nhật sản phẩm/dịch vụ trước khi chọn.`,
      );
      setCurrentStep(1);
      ensureCatalogItemVisible(
        missingEnglishItem.id,
        `contract-item-en-${missingEnglishItem.id}`,
      );
      setFieldErrors({ [`item-en-${missingEnglishItem.id}`]: true });
      return;
    }
    const missingUnitItem = selectedCatalogItems.find(
      (item) =>
        !item.unitName.trim() ||
        (languageMode === ContractLanguageMode.Bilingual &&
          !item.unitNameEn.trim()),
    );
    if (missingUnitItem) {
      const english = Boolean(missingUnitItem.unitName.trim());
      toast.error(
        `“${missingUnitItem.itemName}” thiếu đơn vị${english ? " tiếng Anh" : ""} trong danh mục. Hãy cập nhật sản phẩm/dịch vụ trước khi chọn.`,
      );
      setCurrentStep(1);
      ensureCatalogItemVisible(
        missingUnitItem.id,
        `contract-item-card-${missingUnitItem.id}`,
      );
      setFieldErrors({ [`item-card-${missingUnitItem.id}`]: true });
      return;
    }
    if (invalidFinanceItem) {
      toast.error(
        `Thông tin giá, giảm giá hoặc VAT của "${invalidFinanceItem.itemName}" chưa hợp lệ.`,
      );
      setCurrentStep(1);
      ensureCatalogItemVisible(
        invalidFinanceItem.id,
        `contract-item-card-${invalidFinanceItem.id}`,
      );
      setFieldErrors({ [`item-card-${invalidFinanceItem.id}`]: true });
      return;
    }

    // 3. Validate Step 2: Điều khoản
    if (!hasValidContractDateRange) {
      toast.error("Vui lòng chọn thời hạn hiệu lực của hợp đồng.");
      setCurrentStep(0);
      setFieldErrors({ contractDateRange: true });
      scrollToAndFocus("contract-date-range-container");
      return;
    }
    if (contractTermsValidationError) {
      toast.error(contractTermsValidationError);
      setCurrentStep(2);
      setFieldErrors({ contractTerms: true });
      scrollToAndFocus("contract-terms-container");
      return;
    }
    if (appendicesValidationError) {
      toast.error(appendicesValidationError);
      setCurrentStep(2);
      setFieldErrors({ contractAppendices: true });
      scrollToAndFocus("contract-appendices-container");
      return;
    }
    if (!manualPaymentDatesValid) {
      toast.error(
        "Vui lòng nhập ngày bắt đầu tính hạn cho các đợt dùng Lịch thủ công.",
      );
      setCurrentStep(2);
      setFieldErrors({ contractTerms: true });
      scrollToAndFocus("contract-terms-container");
      return;
    }
    setIsSubmitting(true);
    setSubmitError("");
    try {
      const itemsPayload: CreateContractItemRequest[] =
        selectedCatalogItems.map((item, index) => ({
          itemType: item.itemType,
          sourceProductId:
            item.itemType === ContractItemType.Product ? item.originalId : null,
          sourceServiceId:
            item.itemType === ContractItemType.Service ? item.originalId : null,
          itemName: item.itemName,
          itemNameEn:
            languageMode === ContractLanguageMode.Bilingual
              ? item.itemNameEn.trim()
              : null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountMode: item.discountMode,
          discountPercent: item.discountPercent,
          fixedDiscountAmount: item.fixedDiscountAmount,
          isTaxable: item.isTaxable,
          vatPercent: item.vatPercent,
          displayOrder: index + 1,
        }));

      const payload: CreateContractRequest = {
        customerId: Number(customerId),
        responsibleEmployeeId: Number(responsibleEmployeeId),
        contractType: contractType,
        contractDirection,
        templateVersionId: wordOnly ? 0 : Number(templateVersionId),
        parentContractId:
          contractType !== ContractType.SoftwareSupply && parentContractId
            ? Number(parentContractId)
            : null,
        contractName: contractTitle.trim(),
        contractNameEn:
          languageMode === ContractLanguageMode.Bilingual
            ? contractTitleEn.trim()
            : null,
        effectiveDate: effectiveDate
          ? new Date(effectiveDate).toISOString()
          : null,
        expireDate: expiredDate ? new Date(expiredDate).toISOString() : null,
        currencyCode,
        languageMode: languageMode,
        items: itemsPayload,
        terms: contractTerms.map<CreateContractTermRequest>((term, index) => ({
          sourceTemplateTermId: term.sourceTemplateTermId ?? null,
          termKind: term.termKind,
          paymentMilestones: term.paymentMilestones,
          termCode: term.termCode.trim().toUpperCase(),
          termTitle: term.termTitle.trim(),
          termTitleEn: term.termTitleEn?.trim() || null,
          termContent: term.termContent?.trim() || null,
          termContentEn: term.termContentEn?.trim() || null,
          bilingualContentMode: term.bilingualContentMode,
          isNegotiable: term.isNegotiable,
          displayOrder: index + 1,
        })),
        paymentMilestoneDates: [],
        appendices: contractAppendices.map(toCreateAppendixRequest),
      };

      const response = await contractApi.createFromEditor(editorSource.id, editorSource.revision, payload);

      setFieldErrors({});
      toast.success(`Tạo hợp đồng thành công! Mã HĐ: ${response.contractCode} · Đã gắn bản Word vào phiên bản Nháp.`);
      setCreatedContract(response);
    } catch (error: any) {
      const data = error?.response?.data;
      let errorMessage = "Đã xảy ra lỗi khi tạo hợp đồng.";

      if (data) {
        if (data.errors) {
          errorMessage = Object.values(data.errors).flat().join(", ");
        } else if (typeof data === "string") {
          errorMessage = data;
        } else {
          errorMessage = data.message || data.title || errorMessage;
        }
      }

      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const goToCreatedContractDetails = () => {
    if (!createdContract || isOpeningPreview) return;

    const contractId = createdContract.contractId;
    setCreatedContract(null);
    router.push(`/contracts/${contractId}#terms`);
  };

  const openContractPdfAndGoToDetails = async () => {
    if (!createdContract || isOpeningPreview) return;

    const { contractId } = createdContract;
    const previewWindow = window.open("about:blank", "_blank");

    if (!previewWindow) {
      toast.error(
        "Trình duyệt đã chặn tab xem trước. Vui lòng cho phép cửa sổ bật lên.",
      );
      return;
    }

    previewWindow.opener = null;
    previewWindow.document.title = "Đang tải bản xem trước...";
    previewWindow.document.body.textContent = "Đang tải bản PDF xem trước...";

    setIsOpeningPreview(true);
    try {
      const pdf = await contractApi.downloadPreviewPdf(contractId);
      const pdfUrl = URL.createObjectURL(
        pdf.type === "application/pdf"
          ? pdf
          : new Blob([pdf], { type: "application/pdf" }),
      );
      previewWindow.location.replace(pdfUrl);
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000);
    } catch (error) {
      previewWindow.close();
      console.error("Failed to open contract PDF preview:", error);
      toast.error("Không thể mở bản PDF xem trước của hợp đồng.");
    } finally {
      setIsOpeningPreview(false);
      setCreatedContract(null);
      router.push(`/contracts/${contractId}#terms`);
    }
  };

  if (editorSourceLoading || !editorSource || editorSourceError) {
    return <>
      <Header />
      <div className="grow overflow-y-auto p-4 sm:p-8">
        <Alert variant={editorSourceError ? "destructive" : "default"}>
          {editorSourceLoading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />}
          <AlertTitle>{editorSourceLoading ? "Đang mở bản Word đã lưu" : "Chưa mở được tài liệu nguồn"}</AlertTitle>
          {!editorSourceLoading && <AlertDescription>{editorSourceError || "Chưa có bản Word để tạo hợp đồng."}</AlertDescription>}
        </Alert>
        {!editorSourceLoading && <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => router.push("/contract-editor")}>Mở trình soạn Word</Button>
          <Button variant="outline" onClick={() => router.push("/contract-word-templates")}>Chọn mẫu Word</Button>
        </div>}
      </div>
    </>;
  }

  return (
    <>
      <Header />

      <div ref={wizardScrollRef} className="min-h-0 grow overflow-y-auto bg-muted/20">
        <div className="mx-auto max-w-[90rem] space-y-5 px-3 py-4 sm:px-6 sm:py-6 xl:px-8">
          <div>
            <Button
              variant="ghost"
              className="-ml-3 mb-1 text-muted-foreground"
              onClick={() => router.push("/contracts")}
            >
              <ArrowLeft className="size-4 mr-2" />
              Quay lại danh sách
            </Button>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tạo hợp đồng từ Word</h1>
            <p className="mt-1 text-sm text-muted-foreground">Hoàn tất thông tin, rà soát dữ liệu rồi lưu nháp. Hợp đồng chưa được gửi duyệt ở bước này.</p>
          </div>

          <nav aria-label="Các bước tạo hợp đồng">
            <ol className="grid grid-cols-3 gap-1 rounded-xl border bg-card p-1.5 shadow-sm sm:gap-2 sm:p-2">
              {navigation.map((step, index) => {
                const active = step.id === displayedStepId;
                const complete = index < displayedIndex;
                const blocked = index > displayedIndex && (setupIssues.length > 0 || (step.id === 3 && reviewIssues.length > 0));
                return (
                  <li key={step.id} className="min-w-0">
                    <button type="button" disabled={blocked || isSubmitting} aria-current={active ? "step" : undefined}
                      onClick={() => moveToStep(step.id)}
                      className={cn(
                        "flex h-full w-full items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-55 sm:gap-3 sm:p-3 sm:text-sm",
                        active && "border-primary/30 bg-primary/10 text-primary",
                      )}>
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full bg-muted font-semibold sm:size-8", active && "bg-primary text-primary-foreground", complete && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300")}>
                        {complete ? <CheckCircle2 aria-hidden className="size-4" /> : index + 1}
                      </span>
                      <span>
                        <span className="block font-semibold">{step.title}</span>
                        <span className="hidden text-xs text-muted-foreground sm:block">{step.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <Card className="min-w-0 gap-0 overflow-hidden py-0 shadow-sm">
              <CardHeader className="gap-1.5 border-b px-4 py-5 sm:px-6">
                <p className="text-xs font-semibold text-primary">Bước {displayedIndex + 1} / {navigation.length}</p>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="scroll-mt-4 text-xl font-semibold tracking-tight outline-none">
                  {currentStep === 0 ? "Thông tin hợp đồng" : reviewStep ? "Rà soát dữ liệu" : "Xem lại trước khi lưu"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {currentStep === 0 ? "Kiểm tra thông tin điền sẵn và bổ sung các mục bắt buộc (*)." :
                    reviewStep ? "Lấy nội dung từ Word để giảm nhập lại, hoặc bổ sung thủ công." :
                      "Đối chiếu tài liệu chính thức với thông tin sẽ lưu trong hồ sơ."}
                </p>
              </CardHeader>
              <CardContent className="space-y-6 p-4 sm:p-6">
                {attemptedStep === displayedStepId && currentIssues.length > 0 && (
                  <Alert aria-live="polite" className="border-destructive/35 bg-destructive/5">
                    <CircleAlert className="size-4 text-destructive" />
                    <AlertTitle>Cần bổ sung trước khi tiếp tục</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc space-y-1 pl-4">
                        {currentIssues.map((issue) => <li key={issue.field}><button type="button" onClick={() => focusIssue(issue)} className="text-left font-medium underline underline-offset-2">{issue.message}</button></li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              {/* STEP 1: CUSTOMER & TEMPLATE */}
              {currentStep === 0 && (
                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="contract-title-input">Tên hợp đồng <span className="text-destructive">*</span></Label>
                    <Input
                      id="contract-title-input"
                      maxLength={1000}
                      aria-invalid={!!fieldErrors.contractTitle}
                      className="h-11 bg-background"
                      value={contractTitle}
                      onChange={(event) => {
                        setContractTitle(event.target.value);
                        if (event.target.value.trim()) clearFieldError("contractTitle");
                      }}
                      placeholder="Ví dụ: Cung cấp phần mềm quản lý bán hàng"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contract-customer-id">
                      {counterpartyLabel}{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <div className="flex items-center gap-2">
                      <ContractLookupPicker
                        id="contract-customer-id"
                        label={counterpartyLabel}
                        value={customerId}
                        invalid={!!fieldErrors.customerId}
                        search={customerSearch}
                        searchPlaceholder="Tìm theo tên, mã, mã số thuế…"
                        onSearchChange={setCustomerSearch}
                        loading={isLoadingCustomers || customerSearch.trim() !== debouncedCustomerSearch}
                        error={customerLookupError}
                        options={customers.map((customer) => ({
                          id: String(customer.customerId),
                          label: customer.customerCompany || customer.customerFullName || customer.customerCode || "Chưa có tên",
                          detail: [customer.customerCode, customer.customerTaxCode && `MST ${customer.customerTaxCode}`, customer.customerMobile || customer.customerPhone].filter(Boolean).join(" · "),
                        }))}
                        onSelect={(val) => {
                          setCustomerId(val);
                          setParentContractId("");
                          clearFieldError("customerId");
                        }}
                      />
                      {canManageCustomers && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="size-11 shrink-0"
                          onClick={() => setIsCustomerModalOpen(true)}
                          aria-label={`Tạo nhanh ${counterpartyLabel.toLocaleLowerCase()}`}
                          title={`Tạo nhanh ${counterpartyLabel.toLocaleLowerCase()}`}
                        >
                          <Plus className="size-4" />
                        </Button>
                      )}
                    </div>
                    {selectedCustomer &&
                      (selectedCustomer.customerContactPersonName ||
                        selectedCustomer.customerContactPersonPhone) && (
                        <p className="text-xs text-muted-foreground">
                          Người liên hệ:{" "}
                          <span className="font-medium text-foreground">
                            {selectedCustomer.customerContactPersonName ||
                              "Chưa có"}
                          </span>
                          {selectedCustomer.customerContactPersonTitle &&
                            ` (${selectedCustomer.customerContactPersonTitle})`}
                          {selectedCustomer.customerContactPersonPhone &&
                            ` · SĐT: ${selectedCustomer.customerContactPersonPhone}`}
                        </p>
                      )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <Label htmlFor="contract-employee-id">
                        Nhân viên phụ trách{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <button
                        type="button"
                        onClick={handleAssignToMe}
                        disabled={isLoadingEmployees || !user?.employeeId}
                        className="text-xs font-medium text-primary underline-offset-4 hover:underline disabled:pointer-events-none disabled:opacity-50"
                      >
                        Gán cho tôi
                      </button>
                    </div>
                    <ContractLookupPicker
                      id="contract-employee-id"
                      label="Nhân viên phụ trách"
                      value={responsibleEmployeeId}
                      selectedLabel={responsibleEmployeeId && responsibleEmployeeId === String(user?.employeeId) ? (user?.fullName || "Tôi") : undefined}
                      invalid={!!fieldErrors.responsibleEmployeeId}
                      search={employeeSearch}
                      searchPlaceholder="Tìm theo tên, mã hoặc phòng ban…"
                      onSearchChange={setEmployeeSearch}
                      loading={isLoadingEmployees || employeeSearch.trim() !== debouncedEmployeeSearch}
                      error={employeeLookupError}
                      options={employees.map((employee) => ({
                        id: String(employee.employeeId),
                        label: employee.employeeFullName || employee.employeeCode || "Chưa có tên",
                        detail: [employee.employeeCode, employee.departmentName, employee.employeeTypeName].filter(Boolean).join(" · "),
                      }))}
                      onSelect={(val) => {
                        setResponsibleEmployeeId(val);
                        clearFieldError("responsibleEmployeeId");
                      }}
                    />
                  </div>

                  {editorSource && <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-muted/25 px-3 py-2.5 text-sm md:col-span-2">
                    <div className="flex items-center gap-2"><Settings2 aria-hidden className="size-4 shrink-0 text-primary" /><span>{contractDirection && languageMode ? `${getContractDirectionLabel(contractDirection)} · ${getContractLanguageModeLabel(languageMode)} · ${currencyCode}` : "Cấu hình giao dịch và ngôn ngữ"}</span></div>
                    {contractDirection !== null && languageMode !== null && <Button type="button" size="sm" variant="ghost" aria-expanded={showWordSettings} aria-controls="word-draft-settings"
                      onClick={() => setWordSettingsExpanded(!showWordSettings)}>{showWordSettings ? "Thu gọn" : "Chỉnh thiết lập"}</Button>}
                  </div>}
                  <div id="word-draft-settings" className={cn("gap-4 sm:grid-cols-2 md:col-span-2", showWordSettings ? "grid" : "hidden")}>
                    {!editorSource && <div className="space-y-2">
                      <Label>
                        Loại hợp đồng <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={String(contractType)}
                        onValueChange={handleContractTypeChange}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {contractTypeOptions.filter(type => !editorSource || type === ContractType.SoftwareSupply).map((type) => (
                            <SelectItem key={type} value={String(type)}>
                              {getContractTypeLabel(type)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>}

                    <div className="space-y-2">
                      <Label htmlFor="contract-direction">
                        Chiều giao dịch <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={
                          contractDirection === null
                            ? ""
                            : String(contractDirection)
                        }
                        onValueChange={(value) => {
                          if (wordOnly || value === String(contractDirection)) handleDirectionChange(value);
                          else confirmReviewReset(() => handleDirectionChange(value));
                        }}
                      >
                        <SelectTrigger
                          id="contract-direction"
                          aria-invalid={!!fieldErrors.contractDirection}
                          className={cn("w-full", fieldErrors.contractDirection && "border-destructive")}
                        >
                          <SelectValue placeholder="Chọn Bán hoặc Mua..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">
                            Bán — Doanh nghiệp là bên cung cấp
                          </SelectItem>
                          <SelectItem value="2">
                            Mua — Doanh nghiệp là bên mua
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contract-language-mode">
                        Ngôn ngữ hợp đồng{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={
                          languageMode === null ? "" : String(languageMode)
                        }
                        onValueChange={(value) => {
                          if (wordOnly || value === String(languageMode)) handleLanguageModeChange(value);
                          else confirmReviewReset(() => handleLanguageModeChange(value));
                        }}
                      >
                        <SelectTrigger
                          id="contract-language-mode"
                          className={cn(
                            "w-full",
                            fieldErrors.languageMode &&
                              "border-destructive ring-2 ring-destructive/20",
                          )}
                          aria-invalid={!!fieldErrors.languageMode}
                        >
                          <SelectValue placeholder="Chọn ngôn ngữ hợp đồng..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem
                            value={String(ContractLanguageMode.Vietnamese)}
                          >
                            {getContractLanguageModeLabel(
                              ContractLanguageMode.Vietnamese,
                            )}
                          </SelectItem>
                          <SelectItem
                            value={String(ContractLanguageMode.Bilingual)}
                          >
                            {getContractLanguageModeLabel(
                              ContractLanguageMode.Bilingual,
                            )}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* SELECT HỢP ĐỒNG NGUỒN (CHỈ DÀNH CHO BẢO TRÌ HOẶC DUY TRÌ) */}
                  {contractType !== ContractType.SoftwareSupply && (
                    <div className="space-y-2 md:col-span-2">
                      <Label>
                        Hợp đồng nguồn (HĐ gốc){" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={parentContractId}
                        onValueChange={(val) => {
                          setParentContractId(val);
                          clearFieldError("parentContractId");
                        }}
                        disabled={!customerId || isLoadingEligibleParents}
                      >
                        <SelectTrigger
                          id="contract-parent-id"
                          aria-invalid={!!fieldErrors.parentContractId}
                          className={cn(
                            "w-full",
                            fieldErrors.parentContractId &&
                              "border-destructive ring-2 ring-destructive/20",
                          )}
                        >
                          <SelectValue
                            placeholder={
                              !customerId
                                ? "Vui lòng chọn đối tác trước"
                                : isLoadingEligibleParents
                                  ? "Đang tải hợp đồng nguồn..."
                                  : eligibleParents.length === 0
                                    ? "Không tìm thấy HĐ gốc phù hợp"
                                    : "Chọn hợp đồng gốc..."
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {eligibleParents.map((parent) => (
                            <SelectItem
                              key={parent.contractId}
                              value={String(parent.contractId)}
                            >
                              {parent.contractCode
                                ? `${parent.contractCode} - ${parent.contractName}`
                                : parent.contractName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {contractType !== ContractType.SoftwareSupply &&
                    customerId &&
                    !isLoadingEligibleParents &&
                    eligibleParents.length === 0 && (
                      <div className="md:col-span-2">
                        <Alert variant="destructive">
                          <AlertTitle>
                            Không có hợp đồng nguồn phù hợp
                          </AlertTitle>
                          <AlertDescription>
                            Đối tác đã chọn hiện chưa có hợp đồng cung cấp phần
                            mềm gốc nào ở trạng thái đủ điều kiện để tạo hợp
                            đồng bảo trì hoặc duy trì.
                          </AlertDescription>
                        </Alert>
                      </div>
                    )}

                  {languageMode === ContractLanguageMode.Bilingual && (
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="contract-title-en-input">
                        Tên hợp đồng tiếng Anh{" "}
                        <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="contract-title-en-input"
                        maxLength={1000}
                        aria-invalid={!!fieldErrors.contractTitleEn}
                        className={cn(
                          fieldErrors.contractTitleEn &&
                            "border-destructive ring-2 ring-destructive/20",
                        )}
                        value={contractTitleEn}
                        onChange={(event) => {
                          setContractTitleEn(event.target.value);
                          if (event.target.value.trim()) {
                            clearFieldError("contractTitleEn");
                          }
                        }}
                        placeholder="Nhập tên hợp đồng bằng tiếng Anh..."
                      />
                    </div>
                  )}

                  <div className="space-y-3 md:col-span-2" id="contract-template-source">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <Label>Nguồn tài liệu hợp đồng</Label>
                      </div>
                    </div>

                    {editorSource && (
                      <div className="flex flex-wrap items-center gap-3">
                      <div className="flex max-w-md min-w-0 items-center gap-4 rounded-xl border bg-card p-3 shadow-sm">
                        <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted/40 p-1.5 sm:h-28 sm:w-32">
                          <PdfThumbnail key={`${editorSource.id}:${editorSource.revision}`}
                            kind={editorSource.isTemplate ? "template" : "editor"}
                            id={editorSource.id} revision={editorSource.revision} name={editorSource.title} />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                          <Badge variant="secondary">Word đã soạn</Badge>
                          <p className="break-words text-sm font-semibold">{editorSource.title}</p>
                          <p className="text-xs text-muted-foreground">Phiên bản {editorSource.revision} · Tài liệu chính thức</p>
                        </div>
                      </div>
                      <Button type="button" variant="outline" aria-expanded={useExistingFramework} onClick={() => confirmReviewReset(() => {
                        setTemplateVersionId("");
                        setSelectedTemplateSnapshot(null);
                        setTemplateSearch("");
                        setTemplatePage(1);
                        resetReviewContent();
                        setUseExistingFramework(!useExistingFramework);
                      })}>
                        {useExistingFramework ? "Nhập điều khoản trực tiếp" : "Dùng khung có sẵn"}
                      </Button>
                      </div>
                    )}
                    {!wordOnly && <>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={templateSearch}
                        disabled={
                          languageMode === null || contractDirection === null
                        }
                        onChange={(event) => {
                          setTemplateSearch(event.target.value);
                          setTemplatePage(1);
                        }}
                        className="pl-9"
                        placeholder="Tìm theo tên, mã hoặc mô tả mẫu..."
                        aria-label="Tìm kiếm mẫu hợp đồng"
                      />
                    </div>

                    {isLoadingTemplates && (
                      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed py-8 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        Đang tải mẫu hợp đồng...
                      </div>
                    )}

                    {!isLoadingTemplates && languageMode !== null && (
                      <div
                        id="contract-templates-container"
                        className={cn(
                          "grid gap-3 lg:grid-cols-3 rounded-2xl transition-all",
                          fieldErrors.templateVersionId &&
                            "ring-2 ring-destructive/40 p-2 bg-destructive/5 border border-destructive/30",
                        )}
                      >
                        {paginatedTemplates.map((template) => {
                          const selected =
                            template.versionId === Number(templateVersionId);
                          const compatible =
                            template.contractDirection === contractDirection &&
                            template.contractType === contractType &&
                            template.languageMode === languageMode;

                          return (
                            <button
                              key={template.versionId}
                              type="button"
                              disabled={!compatible}
                              onClick={() => {
                                if (!selected) confirmReviewReset(() => handleTemplateSelect(template.versionId));
                              }}
                              className={`rounded-2xl border p-4 text-left transition-all ${
                                selected
                                  ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary"
                                  : compatible
                                    ? "bg-background hover:border-primary/50 hover:bg-accent/40"
                                    : "cursor-not-allowed bg-muted/30 opacity-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                  <LayoutTemplate className="size-5" />
                                </div>
                                {selected ? (
                                  <Badge className="gap-1">
                                    <CheckCircle2 className="size-3.5" />
                                    Đã chọn
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    Phiên bản {template.version}
                                  </Badge>
                                )}
                              </div>

                              <p className="mt-4 font-semibold leading-snug">
                                {template.name}
                              </p>
                              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {template.description}
                              </p>

                              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span>
                                  {getContractLanguageModeLabel(
                                    template.languageMode,
                                  )}
                                </span>
                                <span>•</span>
                                <span>{template.templateCode}</span>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                {compatible
                                  ? "Phiên bản đã phát hành"
                                  : getContractTypeLabel(template.contractType)}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {languageMode === null || contractDirection === null ? (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                        Chọn chiều giao dịch và ngôn ngữ hợp đồng để tải danh
                        sách mẫu phù hợp.
                      </div>
                    ) : !isLoadingTemplates && templateTotalCount === 0 ? (
                      <div className="rounded-2xl border border-dashed px-4 py-8 text-center">
                        <LayoutTemplate className="mx-auto size-8 text-muted-foreground/60" />
                        <p className="mt-3 text-sm font-medium">
                          Không tìm thấy mẫu phù hợp
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Thử tìm bằng tên, mã mẫu hoặc chọn loại/ngôn ngữ hợp
                          đồng khác.
                        </p>
                      </div>
                    ) : !isLoadingTemplates ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                          Hiển thị {(templatePage - 1) * templatePageSize + 1}–
                          {Math.min(
                            templatePage * templatePageSize,
                            templateTotalCount,
                          )}{" "}
                          trong {templateTotalCount} mẫu
                        </p>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={templatePage === 1}
                            onClick={() =>
                              setTemplatePage((page) => Math.max(1, page - 1))
                            }
                          >
                            <ChevronLeft className="size-4" />
                            Trước
                          </Button>
                          <span className="min-w-20 text-center text-xs font-medium">
                            Trang {templatePage}/{templateTotalPages}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={templatePage === templateTotalPages}
                            onClick={() =>
                              setTemplatePage((page) =>
                                Math.min(templateTotalPages, page + 1),
                              )
                            }
                          >
                            Sau
                            <ChevronRight className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    </>}
                  </div>

                  <div className={cn("space-y-2 md:col-span-2", !showWordSettings && "hidden")}>
                    <Label htmlFor="draft-currency">Đồng tiền thanh toán</Label>
                    <Select
                      value={currencyCode}
                      onValueChange={setCurrencyCode}
                    >
                      <SelectTrigger id="draft-currency" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="VND">VND — Việt Nam đồng</SelectItem>
                        <SelectItem value="USD">USD — Đô la Mỹ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {editorSource && <div className="md:col-span-2">{dateRangeFields}</div>}
                </div>
              )}

              {/* STEP 2: ITEMS, FILTER, PAGINATION */}
              {(currentStep === 1 || (editorSource && reviewStep)) && (
                <>
                {editorSource && <section id="word-catalog-review" className={cn("space-y-4 rounded-xl border bg-muted/20 p-4", fieldErrors.selectedItems && !selectedItems.length && "border-destructive")}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Package aria-hidden className="size-4" /></span>
                      <div>
                        <h3 className="font-semibold">Sản phẩm và dịch vụ</h3>
                        <p className="mt-0.5 text-sm text-muted-foreground">{selectedItems.length ? `${selectedItems.length} hạng mục đã chọn` : "Chưa có hạng mục. Thêm từ bảng Word hoặc danh mục."}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => setWordImportOpen(true)}><FileText className="size-4" /> Lấy từ Word</Button>
                      <Button type="button" size="sm" variant="outline" aria-controls="contract-catalog-container" aria-expanded={wordCatalogExpanded} onClick={() => {
                        setVisibleErrorItemId(null); setPendingCatalogFocus(null); setCatalogSearch(""); setWordCatalogExpanded(true); setItemFilter("all"); setCatalogPage(1);
                      }}><Plus className="size-4" /> Chọn từ danh mục</Button>
                    </div>
                  </div>
                  {selectedCatalogItems.length > 0 && !wordCatalogExpanded && !visibleErrorItemId && (
                    <div className="rounded-lg border bg-card px-3 py-2.5">
                      <ul className="divide-y text-sm">
                        {selectedCatalogItems.slice(0, 3).map((item) => (
                          <li key={item.id} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-0.5 py-2">
                            <span className="min-w-0 flex-1 break-words font-medium">{item.itemName}</span>
                            <span className="max-w-full break-words text-muted-foreground">{item.quantity} {item.unitName} · {formatCurrency(calculateContractItemAmounts(item, currencyCode).lineTotal, currencyCode)}</span>
                          </li>
                        ))}
                      </ul>
                      <Button type="button" size="sm" variant="ghost" className="mt-1 text-primary" onClick={() => {
                        setVisibleErrorItemId(null); setPendingCatalogFocus(null); setCatalogSearch(""); setWordCatalogExpanded(true); setItemFilter("selected"); setCatalogPage(1);
                      }}>Xem và sửa {selectedCatalogItems.length} hạng mục <ArrowRight className="size-4" /></Button>
                    </div>
                  )}
                  {reviewCatalogIssues.length > 0 && <ul className="space-y-1 rounded-lg bg-amber-500/10 p-3 text-sm">
                    {reviewCatalogIssues.map(item => <li key={item.id}>
                      <button type="button" className="text-left text-primary underline underline-offset-2" onClick={() => {
                        setWordCatalogExpanded(true);
                        ensureCatalogItemVisible(item.id, `contract-item-card-${item.id}`);
                      }}>Đối chiếu: {item.itemName}</button>
                    </li>)}
                  </ul>}
                  {(wordCatalogExpanded || visibleErrorItemId) && <Button type="button" size="sm" variant="ghost" onClick={() => { setWordCatalogExpanded(false); setVisibleErrorItemId(null); setPendingCatalogFocus(null); }}>Thu gọn sản phẩm và dịch vụ</Button>}
                </section>}
                <div
                  id="contract-catalog-container"
                  className={cn(
                    "space-y-4 rounded-2xl transition-all",
                    editorSource && !wordCatalogExpanded && !visibleErrorItemId && "hidden",
                    fieldErrors.selectedItems &&
                      "ring-2 ring-destructive/40 p-2 bg-destructive/5 border border-destructive/30",
                  )}
                >
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={catalogSearch}
                      onChange={(event) => {
                        setCatalogSearch(event.target.value);
                        setVisibleErrorItemId(null);
                        setPendingCatalogFocus(null);
                      }}
                      className="pl-9 pr-10"
                      placeholder="Tìm theo mã, tên hoặc mô tả sản phẩm/dịch vụ..."
                      aria-label="Tìm sản phẩm hoặc dịch vụ"
                    />
                    {isLoadingCatalog && (
                      <Loader2 className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-2">
                    <div className="flex flex-wrap gap-1 bg-muted p-1 rounded-lg">
                      <button
                        onClick={() => {
                          setItemFilter("all");
                          setVisibleErrorItemId(null);
                          setPendingCatalogFocus(null);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          itemFilter === "all"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Tất cả
                      </button>
                      <button
                        onClick={() => {
                          setItemFilter("product");
                          setVisibleErrorItemId(null);
                          setPendingCatalogFocus(null);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          itemFilter === "product"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Sản phẩm
                      </button>
                      <button
                        onClick={() => {
                          setItemFilter("service");
                          setVisibleErrorItemId(null);
                          setPendingCatalogFocus(null);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          itemFilter === "service"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Dịch vụ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setItemFilter("selected");
                          setVisibleErrorItemId(null);
                          setPendingCatalogFocus(null);
                        }}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                          itemFilter === "selected"
                            ? "bg-background shadow-sm text-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Đã chọn ({selectedItems.length})
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="px-1 text-sm font-medium text-muted-foreground">
                        Đã chọn:{" "}
                        <span className="font-bold text-primary">
                          {selectedItems.length}
                        </span>
                      </div>
                      {canManageCatalog && (
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsProductModalOpen(true)}
                          >
                            <Plus className="size-4" />
                            Tạo nhanh sản phẩm
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setIsServiceModalOpen(true)}
                          >
                            <Plus className="size-4" />
                            Tạo nhanh dịch vụ
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {isLoadingCatalog && (
                    <div className="py-8 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
                      <Loader2 className="size-5 animate-spin text-primary" />
                      Đang tải danh sách...
                    </div>
                  )}

                  {!isLoadingCatalog && paginatedCatalog.length === 0 && (
                    <div className="py-8 text-center text-sm text-muted-foreground bg-muted/30 rounded-xl border border-dashed">
                      {itemFilter === "selected" ? (
                        selectedItems.length === 0 ? (
                          "Chưa chọn sản phẩm/dịch vụ nào."
                        ) : (
                          "Không tìm thấy sản phẩm/dịch vụ đã chọn phù hợp."
                        )
                      ) : (
                        <>
                          Không tìm thấy{" "}
                          {itemFilter === "product"
                            ? "sản phẩm"
                            : itemFilter === "service"
                              ? "dịch vụ"
                              : "sản phẩm/dịch vụ"}{" "}
                          nào.
                        </>
                      )}
                    </div>
                  )}

                  {/* Danh sách Paginated */}
                  <div className="space-y-3">
                    {paginatedCatalog.map((item) => {
                      const selected = selectedItems.includes(item.id);
                      const amounts = calculateContractItemAmounts(
                        item,
                        currencyCode,
                      );
                      return (
                        <div
                          id={`contract-item-card-${item.id}`}
                          key={item.id}
                          tabIndex={-1}
                          className={cn(
                            "w-full rounded-xl border text-left transition-colors",
                            selected
                              ? "border-primary bg-primary/5"
                              : "bg-background hover:bg-accent",
                            fieldErrors[`item-card-${item.id}`] &&
                              "border-destructive ring-2 ring-destructive/40 bg-destructive/5",
                          )}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <button
                              type="button"
                              className="flex items-start gap-3 flex-1 cursor-pointer text-left p-4 rounded-xl"
                              onClick={() => toggleCatalogItem(item.id)}
                            >
                              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                <Package className="size-5" />
                              </div>
                              <div>
                                <p className="font-semibold">{item.itemName}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                  Phân loại:{" "}
                                  {item.itemType === ContractItemType.Product
                                    ? "Sản phẩm"
                                    : "Dịch vụ"}
                                </p>
                              </div>
                            </button>
                            <div className="flex items-center gap-3">
                              {selected && (
                                <div className="flex items-center gap-2 mr-2">
                                  <span className="text-xs font-medium text-muted-foreground">
                                    SL:
                                  </span>
                                  <IntegerInput
                                    min={1}
                                    value={item.quantity}
                                    onValueChange={(value) =>
                                      updateQuantity(item.id, value)
                                    }
                                    className="h-8 bg-white text-center"
                                  />
                                </div>
                              )}
                              <span className="font-semibold text-primary">
                                {formatCurrency(
                                  amounts.lineTotal,
                                  currencyCode,
                                )}
                              </span>
                              <button
                                type="button"
                                className="cursor-pointer ml-1"
                                onClick={() => toggleCatalogItem(item.id)}
                              >
                                {selected ? (
                                  <Badge className="gap-1 mr-4">
                                    <CheckCircle2 className="size-3.5" />
                                    Đã chọn
                                  </Badge>
                                ) : (
                                  <span className="h-6 px-3 border rounded-full text-xs font-medium flex items-center justify-center text-muted-foreground hover:text-background hover:bg-primary transition-colors mr-4">
                                    Chọn
                                  </span>
                                )}
                              </button>
                            </div>
                          </div>

                          {selected && (
                            <div className="mt-4 grid gap-3 border-t sm:grid-cols-2 xl:grid-cols-4 p-4">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Đơn vị
                                </Label>
                                <p className="text-sm">
                                  {item.unitName ||
                                    "Chưa có đơn vị trong danh mục"}
                                </p>
                              </div>
                              {languageMode ===
                                ContractLanguageMode.Bilingual && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">
                                    Đơn vị tiếng Anh
                                  </Label>
                                  <p className="text-sm">
                                    {item.unitNameEn ||
                                      "Chưa có đơn vị tiếng Anh trong danh mục"}
                                  </p>
                                </div>
                              )}
                              {languageMode ===
                                ContractLanguageMode.Bilingual && (
                                <div className="space-y-1.5 sm:col-span-2 xl:col-span-4">
                                  <Label className="text-xs text-muted-foreground">
                                    Tên sản phẩm / dịch vụ tiếng Anh
                                  </Label>
                                  <p
                                    id={`contract-item-en-${item.id}`}
                                    className={cn(
                                      "rounded-md border bg-muted/30 px-3 py-2 text-sm",
                                      fieldErrors[`item-en-${item.id}`] &&
                                        "border-destructive text-destructive",
                                    )}
                                  >
                                    {item.itemNameEn ||
                                      "Chưa có tên tiếng Anh trong danh mục."}
                                  </p>
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Đơn giá
                                </Label>
                                <DecimalInput
                                  min={0}
                                  value={item.unitPrice}
                                  className="bg-background"
                                  onValueChange={(value) =>
                                    updateCatalogItem(item.id, {
                                      unitPrice: value,
                                    })
                                  }
                                />
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Loại giảm giá
                                </Label>
                                <Select
                                  value={String(item.discountMode)}
                                  onValueChange={(value) =>
                                    updateDiscountMode(
                                      item.id,
                                      Number(value) as ContractItemDiscountMode,
                                    )
                                  }
                                >
                                  <SelectTrigger className="w-full bg-background">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem
                                      value={String(
                                        ContractItemDiscountMode.None,
                                      )}
                                    >
                                      Không giảm
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

                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  {item.discountMode ===
                                  ContractItemDiscountMode.FixedAmount
                                    ? "Tiền giảm"
                                    : "Giảm giá (%)"}
                                </Label>
                                <DecimalInput
                                  min={0}
                                  max={
                                    item.discountMode ===
                                    ContractItemDiscountMode.Percentage
                                      ? 100
                                      : amounts.lineSubtotal
                                  }
                                  disabled={
                                    item.discountMode ===
                                    ContractItemDiscountMode.None
                                  }
                                  value={
                                    item.discountMode ===
                                    ContractItemDiscountMode.FixedAmount
                                      ? item.fixedDiscountAmount
                                      : item.discountPercent
                                  }
                                  className="bg-background"
                                  onValueChange={(value) => {
                                    updateCatalogItem(
                                      item.id,
                                      item.discountMode ===
                                        ContractItemDiscountMode.FixedAmount
                                        ? { fixedDiscountAmount: value }
                                        : {
                                            discountPercent: Math.min(
                                              100,
                                              value,
                                            ),
                                          },
                                    );
                                  }}
                                />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <Label className="text-xs text-muted-foreground">
                                    Thuế VAT (%)
                                  </Label>
                                  <label className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-foreground">
                                    <span className="text-[11px] text-muted-foreground select-none">
                                      {item.isTaxable
                                        ? "Chịu thuế"
                                        : "Không thuế"}
                                    </span>
                                    <Switch
                                      checked={item.isTaxable}
                                      onCheckedChange={(checked) =>
                                        updateCatalogItem(item.id, {
                                          isTaxable: checked,
                                          vatPercent: checked
                                            ? item.vatPercent || 10
                                            : 0,
                                        })
                                      }
                                    />
                                  </label>
                                </div>
                                <DecimalInput
                                  min={0}
                                  max={100}
                                  disabled={!item.isTaxable}
                                  value={item.vatPercent}
                                  placeholder={item.isTaxable ? "10" : "0"}
                                  className="bg-background"
                                  onValueChange={(value) =>
                                    updateCatalogItem(item.id, {
                                      vatPercent: value,
                                    })
                                  }
                                />
                              </div>

                              <div className="grid gap-2 rounded-lg bg-muted/40 p-3 text-xs sm:col-span-2 sm:grid-cols-4 xl:col-span-4">
                                <div>
                                  <p className="text-muted-foreground">
                                    Tạm tính
                                  </p>
                                  <p className="mt-1 font-semibold">
                                    {formatCurrency(
                                      amounts.lineSubtotal,
                                      currencyCode,
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    Giảm giá
                                  </p>
                                  <p className="mt-1 font-semibold text-rose-600">
                                    -
                                    {formatCurrency(
                                      amounts.discountAmount,
                                      currencyCode,
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">VAT</p>
                                  <p className="mt-1 font-semibold">
                                    {formatCurrency(
                                      amounts.vatAmount,
                                      currencyCode,
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">
                                    Thành tiền
                                  </p>
                                  <p className="mt-1 font-semibold text-primary">
                                    {formatCurrency(
                                      amounts.lineTotal,
                                      currencyCode,
                                    )}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Pagination Controls */}
                  {catalogTotalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">
                        Trang {catalogPage} / {catalogTotalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCatalogPage((p) => Math.max(1, p - 1))
                          }
                          disabled={isLoadingCatalog || catalogPage === 1}
                        >
                          <ChevronLeft className="size-4 mr-1" /> Trước
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCatalogPage((p) =>
                              Math.min(catalogTotalPages, p + 1),
                            )
                          }
                          disabled={
                            isLoadingCatalog ||
                            catalogPage === catalogTotalPages
                          }
                        >
                          Sau <ChevronRight className="size-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
                </>
              )}

              {/* STEP 3: TERMS & DATES */}
              {(currentStep === 2 || (editorSource && reviewStep)) && (
                <div className="space-y-5">

                  {isLoadingTemplateDetail && (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Đang tải điều khoản...
                    </div>
                  )}

                  {templateDetailError && (
                    <Alert variant="destructive">
                      <AlertTitle>Không thể tải điều khoản</AlertTitle>
                      <AlertDescription>{templateDetailError}</AlertDescription>
                    </Alert>
                  )}

                  {!isLoadingTemplateDetail && !templateDetailError && (
                    <>
                      <div
                        id="contract-terms-container"
                        className={cn(
                          "rounded-2xl transition-all",
                          fieldErrors.contractTerms &&
                            "ring-2 ring-destructive/40 p-2 bg-destructive/5 border border-destructive/30",
                        )}
                      >
                        {editorSource && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/20 p-4">
                          <div className="flex items-start gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><ListChecks aria-hidden className="size-4" /></span>
                            <div><h3 className="font-semibold">Điều khoản và thanh toán</h3><p className="mt-0.5 text-sm text-muted-foreground">Lấy điều khoản đã soạn hoặc thêm thủ công bên dưới.</p></div>
                          </div>
                          <Button type="button" variant="outline" onClick={() => setWordTermsOpen(true)}>
                            <FileText className="size-4" /> Lấy điều khoản từ Word
                          </Button>
                        </div>}
                        <CreateContractTermsEditor
                          key={templateVersionId}
                          terms={contractTerms}
                          templateName={templateDisplayName ?? selectedTemplate?.name}
                          isBilingual={
                            languageMode === ContractLanguageMode.Bilingual
                          }
                          onChange={(terms) => {
                            setContractTerms(terms);
                            clearFieldError("contractTerms");
                          }}
                        />
                      </div>
                      {editorSource && <Button type="button" variant="outline" size="sm" aria-expanded={wordAppendicesExpanded || !!appendicesValidationError}
                        onClick={() => setWordAppendicesExpanded(open => !open)}>
                        {wordAppendicesExpanded ? "Thu gọn phụ lục" : `Phụ lục (tùy chọn${contractAppendices.length ? ` · ${contractAppendices.length} đã thêm` : ""})`}
                      </Button>}
                      <div
                        id="contract-appendices-container"
                        className={cn(
                          "rounded-2xl space-y-3",
                          editorSource && !wordAppendicesExpanded && !appendicesValidationError && "hidden",
                          fieldErrors.contractAppendices &&
                            "ring-2 ring-destructive/40 p-2",
                        )}
                      >
                        <CreateContractAppendicesEditor
                          key={`appendices-${templateVersionId}`}
                          appendices={contractAppendices}
                          templates={templateAppendices}
                          isBilingual={
                            languageMode === ContractLanguageMode.Bilingual
                          }
                          onChange={(appendices) => {
                            setContractAppendices(appendices);
                            clearFieldError("contractAppendices");
                          }}
                          onPendingFormChange={setHasPendingAppendixForm}
                        />
                        {appendicesValidationError && (
                          <Alert variant="destructive">
                            <AlertTitle>Phụ lục chưa hợp lệ</AlertTitle>
                            <AlertDescription>
                              {appendicesValidationError}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      {contractTermsValidationError &&
                        contractTerms.length > 0 && (
                          <Alert variant="destructive">
                            <AlertTitle>Điều khoản chưa hợp lệ</AlertTitle>
                            <AlertDescription>
                              {contractTermsValidationError}
                            </AlertDescription>
                          </Alert>
                        )}
                    </>
                  )}
                </div>
              )}

              {/* STEP 4: PREVIEW */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  {editorSource && <ContractDraftWordPreview key={`${editorSource.id}:${editorSource.revision}`}
                    source={editorSource} reviewed={editorSourceReviewed} onReview={setEditorSourceReviewed} />}

                  {editorSource && <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="font-semibold">{contractTitle || "Chưa nhập tên hợp đồng"}</h3>
                        <p className="text-sm text-muted-foreground">{selectedCustomer?.customerCompany || selectedCustomer?.customerFullName || `Chưa chọn ${counterpartyLabel.toLocaleLowerCase("vi")}`} · {formatDate(effectiveDate)} – {formatDate(expiredDate)}</p>
                        <p className="text-sm text-muted-foreground">{selectedCatalogItems.length} sản phẩm/dịch vụ · {contractTerms.length} điều khoản{paymentPlan.length ? ` · ${paymentPlan.length} đợt thanh toán` : ""}</p>
                      </div>
                      <Button type="button" size="sm" variant="outline" aria-expanded={wordPreviewDetails} aria-controls="draft-business-preview"
                        onClick={() => setWordPreviewDetails(open => !open)}>{wordPreviewDetails ? "Thu gọn chi tiết" : "Xem chi tiết dữ liệu"}</Button>
                    </div>
                    {reviewCatalogIssues.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{reviewCatalogIssues.length} dòng sản phẩm/dịch vụ cần đối chiếu với Word hoặc danh mục.</p>}
                    {changedWordTerms.length > 0 && <p className="text-sm text-amber-700 dark:text-amber-300">{changedWordTerms.length} điều khoản đã sửa sau khi lấy từ Word.</p>}
                  </section>}

                  <div id="draft-business-preview" className={cn("rounded-2xl border bg-muted/30 p-5", editorSource && !wordPreviewDetails && "hidden")}>
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Hợp đồng nháp
                        </p>
                        <h2 className="mt-1 text-xl font-bold">
                          {contractTitle || "Chưa nhập tên hợp đồng"}
                        </h2>
                        {languageMode === ContractLanguageMode.Bilingual && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {contractTitleEn || "Chưa nhập tên tiếng Anh"}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">Bản nháp</Badge>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Khách hàng
                        </p>
                        <p className="font-semibold">
                          {selectedCustomer?.customerFullName || "Chưa chọn"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Tên công ty: {selectedCustomer?.customerCompany}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Mã KH: {selectedCustomer?.customerCode || "Chưa có"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          MST: {selectedCustomer?.customerTaxCode || "Chưa có"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Điện thoại:{" "}
                          {selectedCustomer?.customerMobile ||
                            selectedCustomer?.customerPhone ||
                            "Chưa có"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Người liên hệ:{" "}
                          {selectedCustomer?.customerContactPersonName ||
                            "Chưa có"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Chức danh liên hệ:{" "}
                          {selectedCustomer?.customerContactPersonTitle ||
                            "Chưa có"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Điện thoại liên hệ:{" "}
                          {selectedCustomer?.customerContactPersonPhone ||
                            "Chưa có"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Nhân viên phụ trách
                        </p>
                        <p className="font-semibold">
                          {selectedEmployee?.employeeFullName || "Chưa chọn"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {selectedEmployee?.departmentName ||
                            "Chưa có phòng ban"}{" "}
                          ·{" "}
                          {selectedEmployee?.employeeTypeName ||
                            "Chưa có vai trò"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Điện thoại:{" "}
                          {selectedEmployee?.employeeMobile || "Chưa có"}
                        </p>
                      </div>
                      {selectedParentContract && (
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Hợp đồng nguồn
                          </p>
                          <p className="font-semibold text-amber-600">
                            {selectedParentContract.contractCode ||
                              selectedParentContract.contractName}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {editorSource ? "Tài liệu Word nguồn" : "Mẫu hợp đồng"}
                        </p>
                        <p className="font-semibold text-blue-600">
                          {editorSource?.title ?? selectedTemplate?.name ?? "Chưa chọn mẫu"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Hiệu lực
                        </p>
                        <p className="font-semibold">
                          {effectiveDate} - {expiredDate}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Tổng giá trị dự kiến
                        </p>
                        <p className="font-semibold text-primary">
                          {formatCurrency(totalValue, currencyCode)}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-5" />

                    <PaymentPlanReview
                      milestones={paymentPlan}
                      currencyCode={currencyCode}
                    />

                    {paymentPlan.length > 0 && <Separator className="my-5" />}

                    <div>
                      <p className="mb-2 text-sm font-semibold">
                        Sản phẩm / dịch vụ ({selectedCatalogItems.length})
                      </p>
                      <div className="space-y-2">
                        {selectedCatalogItems.map((item) => {
                          const amounts = calculateContractItemAmounts(
                            item,
                            currencyCode,
                          );
                          const source = item.wordSource;
                          const differsFromWord = source && (parseWordNumber(source.quantity) !== item.quantity
                            || parseWordNumber(source.price, currencyCode) !== item.unitPrice
                            || (source.total && parseWordNumber(source.total, currencyCode) !== amounts.lineTotal));
                          return (
                            <div
                              key={item.id}
                              className="flex flex-col gap-2 rounded-lg bg-background p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p>{item.itemName}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.quantity} {item.unitName} × {formatCurrency(item.unitPrice, currencyCode)}
                                  {languageMode ===
                                    ContractLanguageMode.Bilingual &&
                                    ` · ${item.unitNameEn}`}
                                </p>
                                {source && <p className={differsFromWord ? "text-xs text-amber-700 dark:text-amber-300" : "text-xs text-muted-foreground"}>
                                  Dòng {source.line} trong Word: {source.quantity || "—"} {source.unit} × {source.price || "—"}
                                  {source.total && ` · Thành tiền ${source.total}`}
                                  {differsFromWord && " · Kiểm tra chênh lệch"}
                                </p>}
                                {languageMode ===
                                  ContractLanguageMode.Bilingual && (
                                  <p className="text-xs text-muted-foreground">
                                    {item.itemNameEn || "Chưa có tên tiếng Anh"}
                                  </p>
                                )}
                              </div>
                              <div className="text-left sm:text-right">
                                <p className="font-semibold text-primary">
                                  {formatCurrency(
                                    amounts.lineTotal,
                                    currencyCode,
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Tạm tính{" "}
                                  {formatCurrency(
                                    amounts.lineSubtotal,
                                    currencyCode,
                                  )}
                                  {amounts.discountAmount > 0 &&
                                    ` · Giảm ${formatCurrency(amounts.discountAmount, currencyCode)}`}
                                  {amounts.vatAmount > 0 &&
                                    ` · VAT ${formatCurrency(amounts.vatAmount, currencyCode)}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-4 space-y-2 rounded-xl border bg-background p-4 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Tạm tính
                          </span>
                          <span>
                            {formatCurrency(
                              financialTotals.subtotal,
                              currencyCode,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Tổng giảm giá
                          </span>
                          <span className="text-rose-600">
                            -
                            {formatCurrency(
                              financialTotals.totalDiscount,
                              currencyCode,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">
                            Tổng VAT
                          </span>
                          <span>
                            {formatCurrency(
                              financialTotals.totalVat,
                              currencyCode,
                            )}
                          </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between font-semibold">
                          <span>Tổng thanh toán</span>
                          <span className="text-primary">
                            {formatCurrency(
                              financialTotals.totalPayment,
                              currencyCode,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    <Separator className="my-5" />

                    <div>
                      <p className="mb-2 text-sm font-semibold">
                        Điều khoản hợp đồng
                      </p>
                      {contractTerms.length === 0 && <p className="text-sm text-muted-foreground">Chưa có điều khoản.</p>}
                      <div className="space-y-2">
                        {contractTerms.map(term => (
                          <details key={term.clientId} className="rounded-xl border bg-background p-3 text-sm">
                            <summary className="cursor-pointer break-words font-medium">{term.termTitle || term.termCode}
                              {term.wordSource && <Badge variant="secondary" className="ml-2">Từ Word</Badge>}
                            </summary>
                            <div className="mt-2 space-y-2 break-words">
                              {term.wordSource && (term.wordSource.title !== term.termTitle || term.wordSource.content !== (term.termContent ?? "")) &&
                                <p className="text-xs text-amber-700 dark:text-amber-300">Điều khoản này đã thay đổi sau khi lấy từ Word. Hãy đối chiếu PDF.</p>}
                              <p className="whitespace-pre-wrap">{termPreviewText(term.termContent) || "Chưa có nội dung."}</p>
                              {term.termTitleEn && <p className="font-medium">{term.termTitleEn}</p>}
                              {term.termContentEn && <p className="whitespace-pre-wrap">{termPreviewText(term.termContentEn)}</p>}
                            </div>
                          </details>
                        ))}
                      </div>
                    </div>

                    {contractAppendices.length > 0 && (
                      <div>
                        <p className="mb-2 text-sm font-semibold">
                          Phụ lục đính kèm
                        </p>
                        <div className="space-y-2 rounded-xl border p-4">
                          {contractAppendices.map((appendix) => (
                            <div
                              key={appendix.clientId}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span>
                                {appendix.appendixCode} —{" "}
                                {appendix.appendixName}
                                <span className="ml-2 text-muted-foreground">
                                  ({appendix.terms.length} điều khoản)
                                </span>
                              </span>
                              {appendix.isRequired && (
                                <Badge variant="secondary">Bắt buộc</Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              </CardContent>
            </Card>
            <aside aria-label="Tóm tắt bản nháp" className="min-w-0 space-y-3 xl:sticky xl:top-4">
              <section className="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold"><FileText aria-hidden className="size-4 text-primary" /> Tóm tắt hợp đồng</h2>
                  <Badge variant="outline">Chưa lưu</Badge>
                </div>
                <p className="break-words text-sm font-semibold">{contractTitle.trim() || "Chưa đặt tên hợp đồng"}</p>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-start gap-2">
                    <Users aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">{counterpartyLabel}</dt>
                      <dd className="break-words font-medium">{selectedCustomer?.customerCompany || selectedCustomer?.customerFullName || "Chưa chọn"}</dd>
                    </div>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Nhân viên phụ trách</dt>
                    <dd className="break-words font-medium">{selectedEmployee?.employeeFullName || (responsibleEmployeeId === String(user?.employeeId) ? user?.fullName || "Tôi" : "Chưa chọn")}</dd>
                  </div>
                  {hasValidContractDateRange && <div>
                    <dt className="text-xs text-muted-foreground">Thời hạn hiệu lực</dt>
                    <dd className="font-medium">{formatDate(effectiveDate)} – {formatDate(expiredDate)}</dd>
                  </div>}
                </dl>
                {currentStep !== 0 && <Button type="button" size="sm" variant="outline" onClick={() => moveToStep(0)} disabled={isSubmitting}>Sửa thông tin</Button>}
              </section>
              {currentStep !== 0 && <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
                <h2 className="flex items-center gap-2 text-sm font-semibold"><WalletCards aria-hidden className="size-4 text-primary" /> Giá trị hợp đồng</h2>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Tạm tính</dt><dd>{formatCurrency(financialTotals.subtotal, currencyCode)}</dd></div>
                  {financialTotals.totalDiscount > 0 && <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Chiết khấu</dt><dd>−{formatCurrency(financialTotals.totalDiscount, currencyCode)}</dd></div>}
                  <div className="flex justify-between gap-2"><dt className="text-muted-foreground">VAT</dt><dd>{formatCurrency(financialTotals.totalVat, currencyCode)}</dd></div>
                  <div className="flex flex-wrap justify-between gap-1 border-t pt-2"><dt className="font-medium">Tổng thanh toán</dt><dd className="font-bold text-primary">{formatCurrency(totalValue, currencyCode)}</dd></div>
                </dl>
                <p className="text-xs text-muted-foreground">{selectedCatalogItems.length} hạng mục · {contractTerms.length} điều khoản</p>
                {currentStep === 3 && <Button type="button" size="sm" variant="outline" onClick={() => moveToStep(1)} disabled={isSubmitting}>Sửa dữ liệu đã rà soát</Button>}
              </section>}
            </aside>
          </div>
        </div>
      </div>
      <div className="z-20 shrink-0 border-t bg-card shadow-[0_-6px_18px_-10px_rgb(0_0_0/0.25)]">
        <div className="mx-auto flex max-w-[90rem] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5 sm:px-6 xl:px-8">
          {submitError && <p role="alert" className="max-h-24 w-full overflow-y-auto rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Chưa lưu được bản nháp: {submitError}</p>}
          <div className="order-first min-w-0 basis-full text-xs text-muted-foreground sm:order-none sm:flex-1 sm:basis-auto sm:text-sm" aria-live="polite">
            {currentIssues.length ? (
              <button type="button" onClick={() => { setAttemptedStep(displayedStepId); focusIssue(currentIssues[0]); }} className="text-left font-medium text-primary underline-offset-2 hover:underline">
                {currentStep === 3 ? "Cần xác nhận đã đối chiếu Word" : `Còn ${currentIssues.length} mục cần bổ sung hoặc kiểm tra`}
              </button>
            ) : <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{currentStep === 3 ? "Có thể lưu bản nháp" : "Đã đủ thông tin để tiếp tục"}</span>}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {currentStep !== 0 && <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => moveToStep(currentStep === 3 ? 1 : 0)}>
              <ArrowLeft className="size-4" /> Quay lại
            </Button>}
            <Button type="button" aria-busy={isSubmitting} disabled={isSubmitting || createdContract !== null} onClick={advance}>
              {currentStep === 3 ? <>
                {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {isSubmitting ? "Đang lưu…" : "Lưu bản nháp"}
              </> : <>{currentStep === 0 ? "Đến bước rà soát" : "Xem trước hợp đồng"} <ArrowRight className="size-4" /></>}
            </Button>
          </div>
        </div>
      </div>

      {canManageCustomers && (
        <CustomerFormModal
          isOpen={isCustomerModalOpen}
          onClose={() => setIsCustomerModalOpen(false)}
          onSuccess={handleCustomerCreated}
        />
      )}

      {editorSource && wordTermsOpen && <WordTermImportDialog
        content={editorSource.content} bindings={editorSource.bindings}
        existingCodes={contractTerms.map(term => term.termCode)}
        onClose={() => setWordTermsOpen(false)} onImport={addTermsFromWord}
      />}
      {editorSource && <WordCatalogImportDialog key={`${editorSource.id}:${editorSource.revision}`}
        open={wordImportOpen} onClose={() => setWordImportOpen(false)}
        content={editorSource.content} bindings={editorSource.bindings} currency={currencyCode}
        selectedIds={selectedItems} onImport={addItemsFromWord}
        onQuickCreate={canManageCatalog ? (kind, pick) => {
          setWordQuickPick(() => pick);
          setWordImportOpen(false);
          if (kind === "product") setIsProductModalOpen(true);
          else setIsServiceModalOpen(true);
        } : undefined}
      />}

      {canManageCatalog && (
        <>
          <ProductFormModal
            isOpen={isProductModalOpen}
            onClose={() => closeQuickCatalogModal("product")}
            onSuccess={handleProductCreated}
          />
          <ServiceFormModal
            isOpen={isServiceModalOpen}
            onClose={() => closeQuickCatalogModal("service")}
            onSuccess={handleServiceCreated}
          />
        </>
      )}

      <ConfirmDialog
        isOpen={pendingSettingsChange !== null}
        onClose={() => setPendingSettingsChange(null)}
        onConfirm={() => {
          pendingSettingsChange?.();
          setPendingSettingsChange(null);
        }}
        title="Thay đổi thiết lập hợp đồng?"
        description="Việc này sẽ làm mới điều khoản, lịch thanh toán và phụ lục ở bước rà soát. Bản Word và các sản phẩm đã chọn được giữ nguyên."
        confirmText="Tiếp tục thay đổi"
        cancelText="Giữ nguyên"
      />
      <ConfirmDialog
        isOpen={createdContract !== null}
        onClose={goToCreatedContractDetails}
        onConfirm={openContractPdfAndGoToDetails}
        title="Xem trước hợp đồng nháp"
        description={
          <>
            Hợp đồng và các điều khoản đã chỉnh sửa được lưu thành công. Bạn có
            muốn mở bản PDF xem trước trong tab mới không?
          </>
        }
        icon={<FileText className="size-5 text-primary" />}
        confirmText="Có, xem PDF"
        cancelText="Không, xem chi tiết"
        isLoading={isOpeningPreview}
      />
    </>
  );
}

export default function CreateContractFromWordPage() {
  return <PermissionGuard permission={RBAC_PERMISSIONS.contractCreate}><CreateContractFromWordWizard /></PermissionGuard>;
}
