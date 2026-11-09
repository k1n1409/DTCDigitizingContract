using ContractManagement.API.Domains.DTOs.Requests.Contract;
namespace ContractManagement.API.Domains.Policies.Contract;
public static class ContractWorkFilterPolicy
{
    public static void Validate(ContractFilterRequest f)
    {
        if (f.MinAmount < 0 || f.MaxAmount < 0 || f.MinAmount > f.MaxAmount) throw new ArgumentException("Khoảng giá trị không hợp lệ.");
        if (f.ExpireFrom?.Date > f.ExpireTo?.Date || f.ExpireTo?.Date == DateTime.MaxValue.Date) throw new ArgumentException("Khoảng ngày hết hạn không hợp lệ.");
        if (f.ExpiringInDays is < 1 or > 365 || (f.ExpiringInDays.HasValue && (f.ExpireFrom.HasValue || f.ExpireTo.HasValue))) throw new ArgumentException("Chọn khoảng ngày hoặc số ngày sắp hết hạn (1–365), không dùng đồng thời.");
        if (f.EmployeeId <= 0 || f.CustomerId <= 0 || f.DepartmentId is <= 0 or > short.MaxValue) throw new ArgumentException("Bộ lọc khách hàng/nhân viên/phòng ban không hợp lệ.");
        if (f.CurrencyCode is not null) { f.CurrencyCode = f.CurrencyCode.Trim().ToUpperInvariant(); if (!System.Text.RegularExpressions.Regex.IsMatch(f.CurrencyCode, "^[A-Z]{3}$")) throw new ArgumentException("Mã tiền tệ phải có 3 chữ cái."); }
        if (f.PaymentState.HasValue && !Enum.IsDefined(f.PaymentState.Value) || f.Status.HasValue && !Enum.IsDefined(f.Status.Value) || f.Outcome.HasValue && !Enum.IsDefined(f.Outcome.Value) || f.ContractType.HasValue && !Enum.IsDefined(f.ContractType.Value)) throw new ArgumentException("Bộ lọc trạng thái/loại hợp đồng không hợp lệ.");
        if (f.ContractDirection.HasValue && !Enum.IsDefined(f.ContractDirection.Value)) throw new ArgumentException("Chiều giao dịch không hợp lệ.");
        if (f.Keyword?.Length > 200) throw new ArgumentException("Từ khóa tối đa 200 ký tự.");
    }
}
