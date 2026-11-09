using ContractManagement.API.Common.Enums;
using ContractManagement.API.Common.Exceptions;
using ContractManagement.API.Common.Security;
using ContractManagement.API.Domains.DTOs.Requests.Contract;
using ContractManagement.API.Domains.DTOs.Responses.Contract;
using ContractManagement.API.Domains.Policies.Contract;
using ContractManagement.Domains.Interfaces.Contract;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed partial class ContractCompletionServicePhase10Tests
{
    private static UpdateContractOutcomeRequest OutcomeRequest(ContractOutcomeResponse current, ContractOutcome outcome, string? reason = "Xác nhận kết quả hồ sơ") => new() {
        CurrentVersionId = current.CurrentVersionId, ContractRowVersion = current.ContractRowVersion,
        VersionRowVersion = current.VersionRowVersion, Outcome = outcome, Reason = reason
    };

    [Fact]
    public async Task Outcome_AdministrationCanMarkFailure_WithoutChangingLegalStateOrArtifacts()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed, activePayments: [100m]);
        const int officer = 12999; db.TblEmployees.Add(Employee(officer, "Hành chính", EmployeeType.AdminOfficer)); await db.SaveChangesAsync();
        var versionHash = (await db.TblContractVersions.SingleAsync()).SnapshotHash;
        var filesBefore = await db.TblFileStorages.CountAsync();
        var service = CreateService(db, new TrackingPrivateStorage());
        var current = await service.GetOutcomeAsync(ContractId, officer);
        Assert.False(current.Options.Single(x => x.Value == ContractOutcome.Succeeded).Allowed);
        var result = await service.UpdateOutcomeAsync(ContractId, OutcomeRequest(current, ContractOutcome.Failed, "Không đạt yêu cầu"), officer);
        Assert.Equal(ContractOutcome.Failed, result.Outcome); Assert.Equal(ContractStatus.Signed, result.LegalStatus);
        Assert.Equal(officer, result.UpdatedByEmployeeId); Assert.Equal("Không đạt yêu cầu", result.Reason);
        Assert.Equal(versionHash, (await db.TblContractVersions.SingleAsync()).SnapshotHash);
        Assert.Equal(filesBefore, await db.TblFileStorages.CountAsync()); Assert.Single(db.TblContractPaymentLedgers);
        Assert.Contains(await db.TblContractAudits.ToListAsync(), x => x.ActionType == ContractAuditActionTypes.ContractOutcomeUpdated && x.ActorEmployeeId == officer && x.Reason!.Contains("Thất bại"));
        await Assert.ThrowsAsync<BusinessRuleException>(() => service.UpdateOutcomeAsync(ContractId, OutcomeRequest(result, ContractOutcome.Succeeded), officer));
        Assert.False((await service.GetReadinessAsync(ContractId, officer)).Ready);
    }

    [Theory]
    [InlineData(ContractOutcome.Failed)]
    [InlineData(ContractOutcome.StoppedRenewal)]
    public async Task Outcome_ReasonIsMandatory(ContractOutcome target)
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        var service = CreateService(db, new TrackingPrivateStorage()); var current = await service.GetOutcomeAsync(ContractId, ManagerId);
        await Assert.ThrowsAsync<ArgumentException>(() => service.UpdateOutcomeAsync(ContractId, OutcomeRequest(current, target, "  "), ManagerId));
        Assert.Equal(0, (await db.TblContracts.SingleAsync()).Outcome);
    }

    [Theory]
    [InlineData(OwnerId)]
    [InlineData(TechnicalId)]
    public async Task Outcome_OwnerAndTechnicalCannotUpdate(int actor)
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        var service = CreateService(db, new TrackingPrivateStorage());
        await Assert.ThrowsAsync<RbacOperationException>(() => service.GetOutcomeAsync(ContractId, actor));
        await Assert.ThrowsAsync<RbacOperationException>(() => service.UpdateOutcomeAsync(ContractId, new() { Outcome = ContractOutcome.Failed }, actor));
    }

    [Fact]
    public async Task Outcome_SuccessReusesCompletionGate_ThenExpiredCompletedCanStopRenewal()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed, includeAcceptance: true, activePayments: [ContractTotal]);
        (await db.TblContracts.SingleAsync()).ExpireDate = DateTimeOffset.UtcNow.ToOffset(TimeSpan.FromHours(7)).Date.AddDays(-1);
        await db.SaveChangesAsync();
        var service = CreateService(db, new TrackingPrivateStorage()); var current = await service.GetOutcomeAsync(ContractId, AccountantId);
        var completed = await service.UpdateOutcomeAsync(ContractId, OutcomeRequest(current, ContractOutcome.Succeeded, "Đã thanh toán đủ"), AccountantId);
        Assert.Equal(ContractStatus.Completed, completed.LegalStatus); Assert.Equal(ContractOutcome.Succeeded, completed.Outcome);
        var stopped = await service.UpdateOutcomeAsync(ContractId, OutcomeRequest(completed, ContractOutcome.StoppedRenewal, "Hết hạn, khách hàng không gia hạn"), AccountantId);
        Assert.Equal(ContractStatus.Completed, stopped.LegalStatus); Assert.Equal(ContractOutcome.StoppedRenewal, stopped.Outcome);
        Assert.True((await db.TblContractVersions.SingleAsync()).IsLocked);
    }

    [Fact]
    public async Task Outcome_StaleTokenAndUnpaidSuccessAreRejected()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        var service = CreateService(db, new TrackingPrivateStorage()); var current = await service.GetOutcomeAsync(ContractId, ManagerId);
        await Assert.ThrowsAsync<BusinessRuleException>(() => service.UpdateOutcomeAsync(ContractId, OutcomeRequest(current, ContractOutcome.Succeeded), ManagerId));
        var contract = await db.TblContracts.SingleAsync(); contract.ContractName += " updated";
        contract.RowVersion = [9, 9, 9, 9, 9, 9, 9, 9]; // SQL Server changes this automatically; InMemory does not.
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => service.UpdateOutcomeAsync(ContractId, OutcomeRequest(current, ContractOutcome.Failed), ManagerId));
        Assert.Equal(0, (await db.TblContracts.SingleAsync()).Outcome);
    }

    [Theory]
    [InlineData(-1, true)]
    [InlineData(0, false)]
    [InlineData(1, false)]
    public void Outcome_ExpiryUsesVietnamCalendarDay(int days, bool allowed)
    {
        var now = new DateTimeOffset(2026, 11, 4, 18, 0, 0, TimeSpan.Zero); // 05/11 Vietnam
        var contract = new TblContract { ContractId = 1, CurrentVersionId = 2, Status = (byte)ContractStatus.Completed, ExpireDate = now.ToOffset(TimeSpan.FromHours(7)).Date.AddDays(days) };
        Assert.Equal(ContractOutcome.Succeeded, ContractOutcomePolicy.Effective(contract));
        var version = new TblContractVersion { ContractId = 1, VersionId = 2, IsLocked = true };
        Assert.Equal(allowed, ContractOutcomePolicy.Blocker(contract, version, ContractOutcome.StoppedRenewal, now) is null);
    }

    [Fact]
    public async Task Outcome_ListFiltersRealFailureAndLegacyCompletedResults()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        // List is a read-only operation and never invokes the audit dependency.
        var list = new ContractManagement.Domains.Services.Contract.ContractService(db, null!);
        var contract = await db.TblContracts.SingleAsync(); contract.Outcome = (byte)ContractOutcome.Failed; await db.SaveChangesAsync();
        var failed = await list.GetListAsync(new() { Outcome = ContractOutcome.Failed }, ManagerId, canReadTenant: true);
        Assert.Equal(ContractOutcome.Failed, Assert.Single(failed.Items).Outcome);
        Assert.Empty((await list.GetListAsync(new() { Outcome = ContractOutcome.InProgress, Status = ContractStatus.Signed }, ManagerId, canReadTenant: true)).Items);
        contract.Outcome = 0; contract.Status = (byte)ContractStatus.Completed; await db.SaveChangesAsync();
        Assert.Equal(ContractOutcome.Succeeded, Assert.Single((await list.GetListAsync(new() { Outcome = ContractOutcome.Succeeded }, ManagerId, canReadTenant: true)).Items).Outcome);
    }
}
