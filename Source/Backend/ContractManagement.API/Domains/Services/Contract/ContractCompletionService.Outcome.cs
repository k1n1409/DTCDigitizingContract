using ContractManagement.API.Common.Enums;
using ContractManagement.API.Domains.DTOs.Requests.Contract;
using ContractManagement.API.Domains.DTOs.Responses.Contract;
using ContractManagement.API.Domains.Policies.Contract;
using ContractManagement.Domains.Interfaces.Contract;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.Domains.Services.Contract;

public sealed partial class ContractCompletionService
{
    public async Task<ContractOutcomeResponse> GetOutcomeAsync(int contractId, int employeeId, CancellationToken ct = default)
    {
        await _authorization.EnsureCanCompleteAsync(contractId, employeeId, ct);
        return await LoadOutcomeAsync(contractId, ct);
    }

    private async Task<ContractOutcomeResponse> LoadOutcomeAsync(int id, CancellationToken ct)
    {
        var contract = await _db.TblContracts.AsNoTracking().SingleAsync(x => x.ContractId == id, ct);
        var version = await _db.TblContractVersions.AsNoTracking().SingleAsync(x => x.VersionId == contract.CurrentVersionId && x.ContractId == id, ct);
        var options = new List<ContractOutcomeOption>();
        foreach (var (value, label) in new[] { (ContractOutcome.Succeeded, "Thành công"), (ContractOutcome.Failed, "Thất bại"), (ContractOutcome.StoppedRenewal, "Dừng gia hạn") })
        {
            var blocker = ContractOutcomePolicy.Blocker(contract, version, value, DateTimeOffset.UtcNow);
            if (blocker is null && value == ContractOutcome.Succeeded)
            {
                var readiness = await BuildReadinessAsync(contract, version, ct);
                if (!readiness.Ready) blocker = string.Join(" ", readiness.Blockers.Select(x => x.Message));
            }
            options.Add(new(value, label, blocker is null, blocker));
        }
        var actorName = contract.OutcomeUpdatedByEmployeeId.HasValue
            ? await _db.TblEmployees.AsNoTracking().Where(x => x.EmployeeId == contract.OutcomeUpdatedByEmployeeId).Select(x => x.EmployeeFullName).SingleOrDefaultAsync(ct) : null;
        return new(id, contract.ContractCode, contract.ContractName, (ContractStatus)contract.Status,
            ContractOutcomePolicy.Effective(contract), contract.OutcomeReason, contract.OutcomeUpdatedAtUtc,
            contract.OutcomeUpdatedByEmployeeId, actorName, version.VersionId,
            Convert.ToBase64String(contract.RowVersion), Convert.ToBase64String(version.RowVersion), options);
    }

    public async Task<ContractOutcomeResponse> UpdateOutcomeAsync(int contractId, UpdateContractOutcomeRequest request, int employeeId, CancellationToken ct = default)
    {
        await _authorization.EnsureCanCompleteAsync(contractId, employeeId, ct);
        if (!Enum.IsDefined(request.Outcome) || request.Outcome == ContractOutcome.InProgress)
            throw new ArgumentException("Chỉ chọn Thành công, Thất bại hoặc Dừng gia hạn.");
        if (request.Reason?.Length > 1000 || (request.Outcome != ContractOutcome.Succeeded && string.IsNullOrWhiteSpace(request.Reason)))
            throw new ArgumentException("Cần nhập lý do cho Thất bại/Dừng gia hạn; tối đa 1000 ký tự.");
        if (request.Outcome == ContractOutcome.Succeeded)
        {
            // Reuse the same completion transaction/gates as the detail screen.
            await CompleteAsync(contractId, new() { CurrentVersionId = request.CurrentVersionId,
                ContractRowVersion = request.ContractRowVersion, VersionRowVersion = request.VersionRowVersion,
                Reason = request.Reason }, employeeId, ct);
            return await LoadOutcomeAsync(contractId, ct);
        }
        return await ExecuteInTransactionAsync(async () =>
        {
            var (contract, version) = await LoadWritableStateAsync(contractId, request.CurrentVersionId, request.ContractRowVersion, request.VersionRowVersion, ct);
            var blocker = ContractOutcomePolicy.Blocker(contract, version, request.Outcome, DateTimeOffset.UtcNow);
            if (blocker is not null) throw Rule("ContractOutcomeNotAllowed", blocker, StatusCodes.Status409Conflict);
            var previous = ContractOutcomePolicy.Effective(contract);
            contract.Outcome = (byte)request.Outcome; contract.OutcomeReason = request.Reason!.Trim();
            contract.OutcomeUpdatedByEmployeeId = employeeId; contract.OutcomeUpdatedAtUtc = DateTime.UtcNow;
            contract.UpdatedEmployeeId = employeeId; contract.UpdateDate = contract.OutcomeUpdatedAtUtc;
            _audit.StageEmployeeAudits([new(contractId, version.VersionId, employeeId,
                ContractAuditActionTypes.ContractOutcomeUpdated, ContractAuditResults.Succeeded, contract.OutcomeUpdatedAtUtc.Value,
                Reason: $"Kết quả {ContractOutcomePolicy.Label(previous)} → {ContractOutcomePolicy.Label(request.Outcome)}: {contract.OutcomeReason}",
                SubjectType: ContractAuditSubjectTypes.Contract, SubjectId: contractId)]);
            await _db.SaveChangesAsync(ct);
            return await LoadOutcomeAsync(contractId, ct);
        }, ct, contractId);
    }
}
