using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ContractManagement.API.Domains.Models.Contract;

namespace ContractManagement.Domains.Services.Contract;

public static class ContractEditorBindingReview
{
    public sealed record Field(string Label, string? Value, bool Manual = false);
    public sealed record Row(string Key, string Group, string Label, Field[] Fields, bool Repeatable = false);
    public sealed record Change(string Group, string Subject, string Field, string? Before, string? After, bool NeedsWordReview);
    public sealed record Difference(int Total, IReadOnlyList<Change> Changes);

    private static readonly CultureInfo Vietnamese = CultureInfo.GetCultureInfo("vi-VN");
    private static string Number(decimal value) => value.ToString("#,##0.####", Vietnamese);
    private static string? Date(DateTime? value) => value?.ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);
    private static Field Text(string label, string? value) => new(label, string.IsNullOrWhiteSpace(value) ? null : value.Trim());
    private static Field ReviewText(string label, string? value) => new(label,
        string.IsNullOrWhiteSpace(value) ? null : Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))), true);

    // This projection is for explaining changes, not for authorizing preview/submission.
    // Keep the existing full business fingerprint as the source of truth.
    public static string Capture(SoftwareSupplyContractSnapshot snapshot, int employeeId)
    {
        var c = snapshot.Contract;
        var customer = snapshot.Customer;
        var tenant = snapshot.Tenant;
        string Money(decimal value) => $"{Number(value)} {c.CurrencyCode}";
        var rows = new List<Row>
        {
            new("contract", "Thông tin chung", "Hợp đồng", [
                Text("Tên hợp đồng", c.ContractName), Text("Tên tiếng Anh", c.ContractNameEn),
                Text("Ngày hiệu lực", Date(c.EffectiveDate)), Text("Ngày hết hạn", Date(c.ExpireDate)),
                Text("Ngày ký", Date(c.SignDate)), Text("Đồng tiền", c.CurrencyCode),
                Text("Mã nhân viên phụ trách", employeeId.ToString(CultureInfo.InvariantCulture))]),
            new("customer", "Thông tin các bên", "Đối tác", [
                Text("Tên đơn vị", customer.LegalName), Text("Mã đối tác", customer.SubjectCode),
                Text("Mã số thuế", customer.TaxCode), Text("Địa chỉ", customer.Address),
                Text("Người đại diện", customer.RepresentativeName), Text("Chức danh", customer.RepresentativeTitle),
                Text("Điện thoại", customer.PhoneNumber), Text("Email", customer.Email),
                ReviewText("Thông tin tài khoản", customer.BankAccountNumber), Text("Ngân hàng", customer.BankName)]),
            new("tenant", "Thông tin các bên", "Đơn vị của bạn", [
                Text("Tên đơn vị", tenant.LegalEntityName), Text("Mã số thuế", tenant.TaxCode),
                Text("Địa chỉ", tenant.Address), Text("Người đại diện", tenant.RepresentativeName),
                Text("Chức danh", tenant.RepresentativeTitle), Text("Điện thoại", tenant.PhoneNumber),
                ReviewText("Thông tin tài khoản", tenant.BankAccountNumber), Text("Ngân hàng", tenant.BankName)]),
            new("total", "Tài chính", "Tổng hợp", [
                Text("Tạm tính", Money(c.Subtotal)), Text("Chiết khấu", Money(c.TotalDiscount)),
                Text("VAT", Money(c.TotalVat)), Text("Tổng thanh toán", Money(c.TotalAmount))])
        };
        rows.AddRange(snapshot.Items.Select(x => new Row($"item:{x.ContractItemId}", "Sản phẩm / Dịch vụ", x.ItemName, [
            Text("Tên", x.ItemName), Text("Tên tiếng Anh", x.ItemNameEn), Text("Mã", x.ItemCode),
            Text("Đơn vị", x.UnitName), Text("Số lượng", Number(x.Quantity)), Text("Đơn giá", Money(x.UnitPrice)),
            Text("Chiết khấu (%)", Number(x.DiscountPercent) + "%"), Text("Tiền chiết khấu", Money(x.DiscountAmount)),
            Text("Thuế suất", x.IsTaxable ? Number(x.VatPercent) + "%" : "Không áp dụng"),
            Text("Thành tiền", Money(x.LineTotal)), ReviewText("Mô tả", x.ItemDescription),
            ReviewText("Mô tả tiếng Anh", x.ItemDescriptionEn)], true)));
        rows.AddRange(snapshot.Terms.Select(x => new Row($"term:{x.TermId}", "Điều khoản", x.TermTitle, [
            Text("Tiêu đề", x.TermTitle), Text("Tiêu đề tiếng Anh", x.TermTitleEn),
            ReviewText("Nội dung", x.TermContent), ReviewText("Nội dung tiếng Anh", x.TermContentEn)], true)));
        rows.AddRange((snapshot.LegalBases ?? []).Select(x => new Row($"basis:{x.LegalBasisId}", "Căn cứ", x.BasisCode, [
            ReviewText("Nội dung", x.ContentVi), ReviewText("Nội dung tiếng Anh", x.ContentEn)], true)));
        rows.AddRange((snapshot.PaymentMilestones ?? []).Select(x => new Row($"payment:{x.PaymentMilestoneId}", "Lịch thanh toán", x.TitleVi, [
            Text("Tên đợt", x.TitleVi), Text("Tỷ lệ", Number(x.PaymentPercent) + "%"),
            Text("Số tiền", Money(x.Amount)), Text("Hạn thanh toán", Date(x.DueDate)),
            Text("Số ngày", x.DueOffsetDays.ToString(CultureInfo.InvariantCulture)),
            ReviewText("Điều kiện", x.ConditionVi), ReviewText("Điều kiện tiếng Anh", x.ConditionEn)], true)));
        foreach (var appendix in snapshot.Appendices ?? [])
        {
            rows.Add(new($"appendix:{appendix.AppendixId}", "Phụ lục", appendix.AppendixName, [
                Text("Tên phụ lục", appendix.AppendixName), ReviewText("Mô tả", appendix.AppendixDescription)], true));
            rows.AddRange(appendix.Terms.Select(x => new Row($"appendix-term:{x.AppendixTermId}", "Phụ lục", $"{appendix.AppendixName} · {x.TermTitle}", [
                Text("Tiêu đề", x.TermTitle), ReviewText("Nội dung", x.TermContent),
                ReviewText("Nội dung tiếng Anh", x.TermContentEn)], true)));
        }
        return JsonSerializer.Serialize(rows);
    }

    public static Difference? Compare(string? baseline, string current)
    {
        if (string.IsNullOrWhiteSpace(baseline)) return null;
        try
        {
            var before = JsonSerializer.Deserialize<Row[]>(baseline)?.ToDictionary(x => x.Key);
            var after = JsonSerializer.Deserialize<Row[]>(current)?.ToDictionary(x => x.Key);
            if (before is null || after is null) return null;
            var changes = new List<Change>();
            foreach (var key in after.Keys.Concat(before.Keys).Distinct())
            {
                before.TryGetValue(key, out var oldRow);
                after.TryGetValue(key, out var newRow);
                var row = (newRow ?? oldRow)!;
                if (oldRow is null || newRow is null)
                {
                    if (row.Repeatable)
                        changes.Add(new(row.Group, row.Label, oldRow is null ? "Đã thêm" : "Đã xóa", oldRow?.Label, newRow?.Label, true));
                    continue;
                }
                var oldFields = oldRow.Fields.ToDictionary(x => x.Label);
                foreach (var field in newRow.Fields)
                {
                    if (!oldFields.TryGetValue(field.Label, out var previous) || previous.Value == field.Value) continue;
                    changes.Add(new(row.Group, row.Label, field.Label,
                        field.Manual ? null : previous.Value, field.Manual ? null : field.Value, field.Manual));
                }
            }
            return new(changes.Count, changes.Take(50).ToArray());
        }
        catch (JsonException) { return null; }
    }
}
