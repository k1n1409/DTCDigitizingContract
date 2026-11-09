using ContractManagement.API.Common.Enums;
namespace ContractManagement.API.Domains.DTOs.Responses.Contract;

public sealed record ContractOutcomeOption(ContractOutcome Value, string Label, bool Allowed, string? Blocker);
public sealed record ContractOutcomeResponse(int ContractId, string? ContractCode, string ContractName,
    ContractStatus LegalStatus, ContractOutcome Outcome, string? Reason, DateTime? UpdatedAtUtc,
    int? UpdatedByEmployeeId, string? UpdatedByEmployeeName, int CurrentVersionId,
    string ContractRowVersion, string VersionRowVersion, IReadOnlyList<ContractOutcomeOption> Options);
