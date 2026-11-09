using ContractManagement.API.Common.Enums;
using ContractManagement.Infrastructure.Persistence.Application.Models;

namespace ContractManagement.API.Domains.Policies.Contract;

public static class ContractOutcomePolicy
{
    public static string Label(ContractOutcome outcome) => outcome switch {
        ContractOutcome.Succeeded => "Thành công", ContractOutcome.Failed => "Thất bại",
        ContractOutcome.StoppedRenewal => "Dừng gia hạn", _ => "Đang thực hiện"
    };
    public static ContractOutcome Effective(TblContract contract) => contract.Outcome == 0 && contract.Status == (byte)ContractStatus.Completed
        ? ContractOutcome.Succeeded : (ContractOutcome)contract.Outcome;

    public static string? Blocker(TblContract contract, TblContractVersion version, ContractOutcome target, DateTimeOffset now)
    {
        if (contract.CurrentVersionId != version.VersionId || version.ContractId != contract.ContractId || !version.IsLocked)
            return "Cần version hợp đồng hiện hành đã khóa sau quy trình duyệt/ký.";
        var current = Effective(contract);
        if (current is ContractOutcome.Failed or ContractOutcome.StoppedRenewal)
            return "Hợp đồng đã chốt kết quả. Không đổi ngược hoặc ghi đè kết quả đã lưu.";
        if (target is ContractOutcome.Succeeded or ContractOutcome.Failed)
            return contract.Status == (byte)ContractStatus.Signed && current == ContractOutcome.InProgress
                ? null : "Chỉ hợp đồng đã ký, đang thực hiện mới được chốt thành công hoặc thất bại.";
        if (target == ContractOutcome.StoppedRenewal)
        {
            if (contract.Status != (byte)ContractStatus.Signed && contract.Status != (byte)ContractStatus.Completed)
                return "Chỉ hợp đồng đã ký hoặc đã hoàn thành mới được dừng gia hạn.";
            if (!contract.ExpireDate.HasValue) return "Chưa có ngày hết hạn hợp đồng để xác định dừng gia hạn.";
            if (contract.ExpireDate.Value.Date >= now.ToOffset(TimeSpan.FromHours(7)).Date)
                return "Hợp đồng chưa hết hạn. Chỉ dừng gia hạn sau ngày hết hạn theo giờ Việt Nam.";
            return null;
        }
        return "Kết quả hợp đồng không hợp lệ; không được tự đặt lại trạng thái đang thực hiện.";
    }
}
