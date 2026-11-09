import { ContractStatus, ContractOutcome, type ContractDetailResponse } from "@/services/contract-api";
import type { ContractCompletionReadinessResponse } from "@/services/contract-completion-api";

export type ContractNextStep = { code: string; title: string; description: string; tab: string; action: string; anchor?: string };
export function contractNextSteps(contract: ContractDetailResponse, completion?: ContractCompletionReadinessResponse | null): ContractNextStep[] {
  const step = (code: string, title: string, description: string, tab: string, action: string, anchor?: string): ContractNextStep => ({ code, title, description, tab, action, anchor });
  if (contract.outcome === ContractOutcome.Failed || contract.outcome === ContractOutcome.StoppedRenewal)
    return [step("closed-result", "Hồ sơ đã chốt kết quả", contract.outcomeReason || "Không còn bước xử lý bắt buộc trong quy trình hiện tại. Chứng từ và công nợ vẫn được giữ.", "activity", "Xem lịch sử")];
  if (contract.status === ContractStatus.Completed) return [step("completed", "Hợp đồng đã hoàn tất", "Hồ sơ đã được đóng. Có thể tra cứu chứng từ và lịch sử xử lý.", "activity", "Xem lịch sử hoàn tất")];
  if ([ContractStatus.Cancelled, ContractStatus.Rejected].includes(contract.status)) return [step("stopped", "Quy trình đã dừng", "Xem lịch sử để biết lý do dừng xử lý hợp đồng.", "activity", "Xem lý do")];
  if (contract.status === ContractStatus.Draft) return [step("draft", "Hoàn thiện bản nháp trước khi đàm phán", "Kiểm tra khách hàng, sản phẩm, giá trị và điều khoản. Sau khi rà soát, dùng nút Bắt đầu đàm phán ở đầu trang.", contract.currentVersion.items.length ? "terms" : "overview", contract.currentVersion.items.length ? "Rà soát điều khoản" : "Bổ sung sản phẩm / thông tin")];
  if (contract.status === ContractStatus.PendingAdministrativeReview) return [step("administrative-review", "Đang chờ hành chính kiểm tra", "Hành chính cần kiểm tra hồ sơ trước khi trình Manager quyết định. Không cần gửi lại yêu cầu duyệt.", "approval", "Mở hồ sơ phê duyệt")];
  if (contract.status === ContractStatus.PendingApproval) return [step("approval", "Đang chờ Manager phê duyệt", "Theo dõi yêu cầu hiện tại và phản hồi của người có thẩm quyền.", "approval", "Xem tiến trình duyệt")];
  if (contract.status === ContractStatus.PendingSignature) return [step("signature", "Đã duyệt, đang chờ ghi nhận bản ký", "Bộ phận có quyền ký cần hoàn tất ký và bổ sung bản scan/bằng chứng ký hợp lệ.", "signature", "Mở phần ký hợp đồng")];
  if (contract.status === ContractStatus.Negotiating) {
    const rows: ContractNextStep[] = [];
    const readiness = contract.approvalReadiness;
    if (readiness?.openCommentCount > 0) rows.push(step("comments", `Còn ${readiness.openCommentCount} trao đổi chưa xử lý`, "Rà soát các trao đổi điều khoản và chốt phản hồi trước khi gửi duyệt.", "terms", "Mở điều khoản - trao đổi"));
    for (const b of readiness?.blockers || []) {
      if (["ContractNotNegotiating", "CurrentVersionLocked"].includes(b.code)) continue;
      if (/Comment/i.test(b.code) && readiness.openCommentCount > 0) continue;
      const tab = /Term|BilingualContent|Comment/i.test(b.code) ? "terms" : /Appendix/i.test(b.code) ? "appendices" : "overview";
      rows.push(step(b.code, b.message, "Bổ sung hoặc điều chỉnh mục này trước khi gửi duyệt.", tab, "Đi đến phần cần xử lý"));
    }
    return rows.length ? rows : [step("submit", "Rà soát và gửi duyệt", "Các điều kiện nghiệp vụ đang đủ để tiếp tục. Kiểm tra nội dung rồi dùng nút Gửi duyệt ở đầu trang; server sẽ kiểm tra tài liệu khi gửi.", "approval", "Mở phần phê duyệt")];
  }
  if (contract.status === ContractStatus.Signed) {
    if (!completion) return [];
    const rows: ContractNextStep[] = [];
    if (!completion.signed) rows.push(step("signed-file", "Thiếu bản ký hợp lệ", "Kiểm tra lại bằng chứng ký của version hiện hành.", "signature", "Kiểm tra bản ký"));
    if (!completion.acceptanceCompleted) rows.push(step("acceptance", "Còn thiếu biên bản nghiệm thu", completion.blockers.filter(b => /ACCEPTANCE/.test(b.code)).map(b => b.message).join(" ") || "Bổ sung biên bản nghiệm thu đã ký cho các đợt còn thiếu.", "closing", "Mở phần nghiệm thu", "contract-next-acceptance"));
    if (!completion.paymentCompleted) rows.push(step("payment", completion.remainingAmount < 0 ? "Cần kiểm tra khoản thanh toán vượt giá trị" : "Hợp đồng chưa thanh toán đủ", completion.blockers.filter(b => /PAYMENT/.test(b.code)).map(b => b.message).join(" ") || "Rà soát khoản thanh toán, chứng từ và các đợt thanh toán chưa hoàn tất.", "closing", "Mở phần thanh toán", "contract-next-payments"));
    if (!rows.length && completion.ready) rows.push(step("complete", "Đủ điều kiện hoàn tất hợp đồng", "Người có quyền đóng hợp đồng có thể xác nhận hoàn tất từ checklist.", "closing", "Mở checklist hoàn tất", "contract-next-checklist"));
    if (!rows.length) rows.push(step("check", "Kiểm tra điều kiện đóng hợp đồng", completion.blockers.map(b => b.message).join(" ") || "Tải lại hồ sơ để kiểm tra trạng thái mới nhất.", "closing", "Mở checklist", "contract-next-checklist"));
    return rows;
  }
  return [];
}
