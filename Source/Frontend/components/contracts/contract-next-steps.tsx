"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, ListChecks, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { contractCompletionApi, type ContractCompletionReadinessResponse } from "@/services/contract-completion-api";
import { ContractStatus, type ContractDetailResponse } from "@/services/contract-api";
import { contractNextSteps, type ContractNextStep } from "@/lib/contract-next-steps";
import { getApiErrorMessage } from "@/lib/api-error";

export function ContractNextSteps({ contract, onNavigate, onRefresh }: { contract: ContractDetailResponse; onNavigate: (tab: string) => void; onRefresh: () => void }) {
  const [readiness, setReadiness] = useState<ContractCompletionReadinessResponse | null>(null);
  const [error, setError] = useState(""); const [loading, setLoading] = useState(contract.status === ContractStatus.Signed); const [reload, setReload] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (contract.status !== ContractStatus.Signed) return;
    let active = true;
    const start = setTimeout(() => {
      setLoading(true); setReadiness(null); setError("");
      void contractCompletionApi.getReadiness(contract.contractId).then(data => { if (active) setReadiness(data); }).catch(e => { if (active) setError(getApiErrorMessage(e, "Không kiểm tra được điều kiện tiếp theo.")); }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; clearTimeout(start); };
  }, [contract.contractId, contract.currentVersion.versionId, contract.rowVersion, contract.status, reload]);
  const navigate = (step: ContractNextStep) => {
    if (timer.current) clearTimeout(timer.current);
    onNavigate(step.tab);
    let attempts = 0;
    const locate = () => {
      const node = step.anchor ? document.getElementById(step.anchor) : document.querySelector<HTMLElement>(`[role="tabpanel"][data-state="active"]`);
      if (node) { node.scrollIntoView({ behavior: "smooth", block: "start" }); return; }
      if (++attempts < 50) timer.current = setTimeout(locate, 100);
    };
    timer.current = setTimeout(locate, 100);
  };
  const steps = contractNextSteps(contract, readiness);
  return <section aria-label="Bước tiếp theo" className="rounded-xl border border-primary/30 bg-primary/5 p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><ListChecks className="size-5 text-primary" />Bước tiếp theo</h2><Button size="sm" variant="outline" disabled={loading} onClick={() => { onRefresh(); setReload(n => n + 1); }}><RefreshCw className="mr-2 size-4" />Cập nhật</Button></div>
    {loading ? <p className="flex items-center gap-2 text-sm"><Loader2 className="size-4 animate-spin" />Đang kiểm tra hồ sơ ký, nghiệm thu và thanh toán...</p> : error ? <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm text-destructive"><p>{error}</p><Button variant="outline" onClick={() => setReload(n => n + 1)}>Thử lại</Button></div> : <div className="grid gap-3 lg:grid-cols-2">{steps.map(step => <div key={step.code} className="flex flex-col items-start gap-2 rounded-xl border bg-background p-4"><h3 className="font-medium">{step.title}</h3><p className="text-sm text-muted-foreground">{step.description}</p><Button size="sm" variant="outline" className="mt-auto" onClick={() => navigate(step)}>{step.action}<ArrowRight className="ml-2 size-4" /></Button></div>)}{!steps.length && <p className="text-sm text-muted-foreground">Chưa có hướng dẫn cho trạng thái hiện tại. Mở hồ sơ để kiểm tra.</p>}</div>}
  </section>;
}
