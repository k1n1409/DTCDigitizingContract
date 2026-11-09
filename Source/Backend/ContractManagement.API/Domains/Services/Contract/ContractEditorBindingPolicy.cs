using System.Security.Cryptography;
using System.Text;
using ContractManagement.API.Domains.Models.Contract;
using ContractManagement.Infrastructure.Persistence.Application.Models;

namespace ContractManagement.Domains.Services.Contract;

public static class ContractEditorBindingPolicy
{
    public static string BusinessFingerprint(SoftwareSupplyContractSnapshot snapshot, int responsibleEmployeeId) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{SoftwareSupplyContractSnapshotFactory.CalculateHash(snapshot)}:{responsibleEmployeeId}")));

    public static void RequireMutableVersion(TblContract contract, TblContractVersion version, byte[] contractToken, byte[] versionToken)
    {
        if (contract.CurrentVersionId != version.VersionId || contract.ContractId != version.ContractId || version.IsLocked || (contract.Status != 0 && contract.Status != 1))
            throw new InvalidOperationException("Chỉ ghim vào version hiện hành chưa khóa, ở trạng thái Nháp hoặc Đàm phán.");
        if (contractToken.Length == 0 || versionToken.Length == 0 || !contract.RowVersion.SequenceEqual(contractToken) || !version.RowVersion.SequenceEqual(versionToken))
            throw new InvalidOperationException("Hợp đồng vừa thay đổi. Tải lại và rà soát trước khi ghim.");
    }

    public static byte[] RequireDocument(TblContractVersion version, ContractVersionEditorDocument? document, string businessHash)
    {
        if (document is null || document.VersionId != version.VersionId || document.ContractId != version.ContractId)
            throw new InvalidOperationException("Version này dùng tài liệu soạn thảo nhưng chưa được ghim tài liệu. Hãy rà soát và liên kết tài liệu cho đúng version trước khi xem/gửi duyệt.");
        if (!string.Equals(document.BusinessHash, businessHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Dữ liệu nghiệp vụ đã thay đổi sau khi ghim tài liệu. Cần đối chiếu và ghim lại trước khi xem/gửi duyệt; không tự quay về bản từ mẫu.");
        if (document.Docx.Length == 0 || !string.Equals(Convert.ToHexString(SHA256.HashData(document.Docx)), document.DocxHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Tài liệu chính thức không khớp SHA-256. Dừng xử lý để tránh dùng bản sai.");
        return document.Docx;
    }
}
