using System.ComponentModel.DataAnnotations;

namespace ContractManagement.API.Domains.DTOs.Requests.Contract
{
    /// <summary>
    /// Item được gửi khi cập nhật Draft.
    ///
    /// Có ContractItemId: cập nhật item hiện có.
    /// Không có ContractItemId: tạo item mới.
    /// </summary>
    public class UpdateContractItemRequest : CreateContractItemRequest
    {
        // An explicit edit to the contract snapshot, not to the catalog item.
        public bool OverrideCatalogUnit { get; set; }
        [Range(1, int.MaxValue)]
        public int? ContractItemId { get; set; }

        /// <summary>
        /// Bắt buộc khi ContractItemId có giá trị.
        /// </summary>
        public string? RowVersion { get; set; }
    }
}
