using ContractManagement.API.Common.Enums;
using ContractManagement.API.Common.Security;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Common.Enums;
using ContractManagement.Domains.Services.Contract;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static ContractManagement.Tests.ContractRichTextTestData;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed partial class ContractCompletionServicePhase10Tests
{
    private static AdministrativeTextController CorrectionApi(DbDtctechContext db, int actor = ManagerId)
    {
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(TenantId, "TENANT-PHASE12", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new CorrectionSession() }; http.Session.SetInt32("EmployeeId", actor);
        return new(db, tenant, new ContractResourceAuthorizationService(db), new ContractAuditWriter(db, tenant, new HttpContextAccessor { HttpContext = http })) { ControllerContext = new ControllerContext { HttpContext = http } };
    }
    private static async Task<AdministrativeTextController.EditRequest> CorrectionRequest(DbDtctechContext db)
    {
        var contract = await db.TblContracts.SingleAsync(); var term = await db.TblContractTerms.FirstAsync();
        return new() { VersionId = VersionId, RowId = term.TermId, Kind = "term",
            ParentRowVersion = Convert.ToBase64String(contract.RowVersion), RowVersion = Convert.ToBase64String(term.RowVersion),
            Title = "Điều khoản sửa trực tiếp", ContentVi = RichText("Nội dung hành chính đã sửa"), Reason = "Theo yêu cầu rà soát", Confirmed = true };
    }

    [Theory]
    [InlineData(ManagerId)]
    [InlineData(12998)]
    public async Task TextCorrection_UpdatesSignedTermInPlace_PreservesLockedSnapshot_AndStoresBeforeAfter(int actor)
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        if (actor != ManagerId) { db.TblEmployees.Add(Employee(actor, "Hành chính", EmployeeType.AdminOfficer)); await db.SaveChangesAsync(); }
        var request = await CorrectionRequest(db); var hash = (await db.TblContractVersions.SingleAsync()).SnapshotHash;
        var original = (await db.TblContractTerms.FirstAsync()).TermContent;
        var files = await db.TblFileStorages.CountAsync();
        Assert.IsType<OkObjectResult>(await CorrectionApi(db, actor).Edit("contract", ContractId, request, default));
        Assert.Equal(request.ContentVi, (await db.TblContractTerms.FirstAsync()).TermContent);
        var version = await db.TblContractVersions.SingleAsync(); Assert.Equal(hash, version.SnapshotHash); Assert.True(version.IsLocked);
        Assert.Single(db.TblContractVersions); Assert.Equal((byte)ContractStatus.Signed, (await db.TblContracts.SingleAsync()).Status);
        Assert.Equal(files, await db.TblFileStorages.CountAsync());
        var history = await db.Set<AdministrativeTextEdit>().SingleAsync();
        Assert.Equal(actor, history.EmployeeId); Assert.Equal(request.Reason, history.Reason);
        Assert.Equal(request.ContentVi, System.Text.Json.JsonDocument.Parse(history.AfterJson).RootElement.GetProperty("ContentVi").GetString());
        Assert.Equal(original, System.Text.Json.JsonDocument.Parse(history.BeforeJson).RootElement.GetProperty("ContentVi").GetString());
        Assert.IsType<OkObjectResult>(await CorrectionApi(db).Get("contract", ContractId, default));
        // The exemption cannot leak into another save; the original guard still applies.
        (await db.TblContractTerms.FirstAsync()).TermContent = RichText("Outside scope");
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Theory]
    [InlineData(OwnerId)]
    [InlineData(TechnicalId)]
    [InlineData(AccountantId)]
    public async Task TextCorrection_OnlyExplicitAdministrativePermissionCanWrite(int actor)
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        var request = await CorrectionRequest(db);
        await Assert.ThrowsAsync<RbacOperationException>(() => CorrectionApi(db, actor).Edit("contract", ContractId, request, default));
        Assert.Empty(db.Set<AdministrativeTextEdit>());
    }

    [Fact]
    public async Task TextCorrection_RejectsStaleTokenAndMissingConfirmation()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        var request = await CorrectionRequest(db); request.Confirmed = false;
        Assert.IsType<BadRequestObjectResult>(await CorrectionApi(db).Edit("contract", ContractId, request, default));
        request.Confirmed = true; request.ParentRowVersion = Convert.ToBase64String([9, 9, 9, 9, 9, 9, 9, 9]);
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => CorrectionApi(db).Edit("contract", ContractId, request, default));
        Assert.Empty(db.Set<AdministrativeTextEdit>());
    }

    [Fact]
    public async Task TextCorrection_ScopeCannotChangeCodeOrAppendOnlyHistory()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        using (db.BeginAdministrativeTextCorrection(VersionId))
        {
            (await db.TblContractTerms.FirstAsync()).TermCode = "ILLEGAL_CHANGE";
            await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
        }
        db.ChangeTracker.Clear();
        var request = await CorrectionRequest(db);
        await CorrectionApi(db).Edit("contract", ContractId, request, default);
        (await db.Set<AdministrativeTextEdit>().SingleAsync()).Reason = "Overwrite history";
        await Assert.ThrowsAsync<InvalidOperationException>(() => db.SaveChangesAsync());
    }

    [Fact]
    public async Task TextCorrection_PublishedTemplateKeepsVersionAndOriginalDocumentIdentity()
    {
        await using var db = CreateContext(); await SeedAsync(db, ContractStatus.Signed);
        db.TblContractTemplates.Add(new() { TemplateId = 555, TemplateName = "Mẫu", LanguageMode = (byte)ContractLanguageMode.Vietnamese });
        db.TblContractTemplateVersions.Add(new() { TemplateVersionId = 556, TemplateId = 555, VersionNo = 2, Status = (byte)TemplateVersionStatus.Published, DocumentFileId = 777, DocumentHash = "UNCHANGED", RowVersion = InitialRowVersion.ToArray() });
        db.TblContractTemplateLegalBases.Add(new() { TemplateLegalBasisId = 557, TemplateVersionId = 556, BasisCode = "LAW", ContentVi = RichText("Căn cứ cũ"), RowVersion = InitialRowVersion.ToArray() });
        await db.SaveChangesAsync();
        var parent = await db.TblContractTemplateVersions.SingleAsync(); var row = await db.TblContractTemplateLegalBases.SingleAsync();
        var result = await CorrectionApi(db).Edit("template", 556, new() { VersionId = 556, RowId = 557, Kind = "basis", ParentRowVersion = Convert.ToBase64String(parent.RowVersion), RowVersion = Convert.ToBase64String(row.RowVersion), ContentVi = RichText("Căn cứ cập nhật"), Reason = "Rà soát căn cứ", Confirmed = true }, default);
        Assert.IsType<OkObjectResult>(result); Assert.Equal(RichText("Căn cứ cập nhật"), row.ContentVi);
        Assert.Equal((byte)TemplateVersionStatus.Published, parent.Status); Assert.Equal(2, parent.VersionNo); Assert.Equal(777, parent.DocumentFileId); Assert.Equal("UNCHANGED", parent.DocumentHash);
        Assert.Single(db.TblContractTemplateVersions); Assert.Single(db.Set<AdministrativeTextEdit>());
    }

    private sealed class CorrectionSession : ISession
    {
        private readonly Dictionary<string, byte[]> data = []; public bool IsAvailable => true; public string Id => "correction"; public IEnumerable<string> Keys => data.Keys;
        public void Clear() => data.Clear(); public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask; public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Remove(string key) => data.Remove(key); public void Set(string key, byte[] value) => data[key] = value; public bool TryGetValue(string key, out byte[] value) => data.TryGetValue(key, out value!);
    }
}
