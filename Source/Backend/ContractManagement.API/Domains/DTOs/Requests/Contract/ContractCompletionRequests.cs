using System.ComponentModel.DataAnnotations;
using ContractManagement.API.Common.Enums;

namespace ContractManagement.API.Domains.DTOs.Requests.Contract;

public sealed class AddContractPaymentRequest
{
    public IFormFile? EvidenceFile { get; set; }
    public int CurrentVersionId { get; set; }
    public string ContractRowVersion { get; set; } = string.Empty;
    public string VersionRowVersion { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
    public decimal Amount { get; set; }
    public string CurrencyCode { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = string.Empty;
    public string ReferenceCode { get; set; } = string.Empty;
}

public sealed class CompleteContractPaymentMilestoneRequest
{
    public IFormFile? EvidenceFile { get; set; }
    public int CurrentVersionId { get; set; }
    public string ContractRowVersion { get; set; } = string.Empty;
    public string VersionRowVersion { get; set; } = string.Empty;
    public string MilestoneRowVersion { get; set; } = string.Empty;
    public DateTime PaymentDate { get; set; }
    public string PaymentMethod { get; set; } = string.Empty;
    public string ReferenceCode { get; set; } = string.Empty;
}

public sealed class ReopenContractPaymentMilestoneRequest
{
    public int CurrentVersionId { get; set; }
    public string ContractRowVersion { get; set; } = string.Empty;
    public string VersionRowVersion { get; set; } = string.Empty;
    public string MilestoneRowVersion { get; set; } = string.Empty;
    public string PaymentRowVersion { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class VoidContractPaymentRequest
{
    public string ContractRowVersion { get; set; } = string.Empty;
    public string VersionRowVersion { get; set; } = string.Empty;
    public string PaymentRowVersion { get; set; } = string.Empty;

    [Required]
    [MaxLength(1000)]
    public string Reason { get; set; } = string.Empty;
}

public sealed class CompleteContractRequest
{
    [MaxLength(1000)] public string? Reason { get; set; }
    public int CurrentVersionId { get; set; }
    public string ContractRowVersion { get; set; } = string.Empty;
    public string VersionRowVersion { get; set; } = string.Empty;
}

public sealed class UpdateContractOutcomeRequest
{
    [Range(1, int.MaxValue)] public int CurrentVersionId { get; set; }
    [Required] public string ContractRowVersion { get; set; } = "";
    [Required] public string VersionRowVersion { get; set; } = "";
    [EnumDataType(typeof(ContractManagement.API.Common.Enums.ContractOutcome))]
    public ContractManagement.API.Common.Enums.ContractOutcome Outcome { get; set; }
    [MaxLength(1000)] public string? Reason { get; set; }
}
