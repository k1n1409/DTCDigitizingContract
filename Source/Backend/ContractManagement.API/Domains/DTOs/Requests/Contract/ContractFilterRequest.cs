using ContractManagement.API.Common.Enums;

namespace ContractManagement.API.Domains.DTOs.Requests.Contract
{
    /// <summary>
    /// Điều kiện tìm kiếm danh sách hợp đồng.
    /// Các bộ lọc đều không bắt buộc.
    /// </summary>
    public class ContractFilterRequest
    {
        public int Page { get; set; } = 1;

        public int PageSize { get; set; } = 20;

        /// <summary>
        /// Tìm theo mã hợp đồng, tên hợp đồng hoặc thông tin khách hàng.
        /// </summary>
        public string? Keyword { get; set; }

        public ContractStatus? Status { get; set; }
        [System.ComponentModel.DataAnnotations.EnumDataType(typeof(ContractOutcome))]
        public ContractOutcome? Outcome { get; set; }

        public ContractType? ContractType { get; set; }

        [System.ComponentModel.DataAnnotations.EnumDataType(typeof(ContractDirection))]
        public ContractDirection? ContractDirection { get; set; }

        public int? CustomerId { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, int.MaxValue)] public int? ContractId { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, short.MaxValue)] public int? DepartmentId { get; set; }
        public bool OnlyMine { get; set; }
        [System.Text.Json.Serialization.JsonNumberHandling(System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString | System.Text.Json.Serialization.JsonNumberHandling.WriteAsString)] public decimal? MinAmount { get; set; }
        [System.Text.Json.Serialization.JsonNumberHandling(System.Text.Json.Serialization.JsonNumberHandling.AllowReadingFromString | System.Text.Json.Serialization.JsonNumberHandling.WriteAsString)] public decimal? MaxAmount { get; set; }
        public string? CurrencyCode { get; set; }
        public DateTime? ExpireFrom { get; set; }
        public DateTime? ExpireTo { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, 365)] public int? ExpiringInDays { get; set; }
        [System.ComponentModel.DataAnnotations.EnumDataType(typeof(ContractPaymentFilterState))]
        public ContractPaymentFilterState? PaymentState { get; set; }
    }
}
