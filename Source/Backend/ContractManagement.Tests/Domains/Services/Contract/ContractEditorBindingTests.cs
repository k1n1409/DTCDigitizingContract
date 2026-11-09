using System.Security.Cryptography;
using ContractManagement.API.Common.Enums;
using ContractManagement.Domains.Services.Contract;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.EntityFrameworkCore;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using ContractManagement.Infrastructure.Persistence.Application;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using static ContractManagement.Tests.ContractRichTextTestData;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed partial class ContractDocumentPreviewServiceTests
{
    [Fact]
    public async Task WordOnlyContract_UsesPinnedDocxWithoutAnyTemplateRows()
    {
        await using var db = CreateContext();
        var docx = CreateSourceDocument();
        await SeedAsync(db, docx);
        var contract = await db.TblContracts.SingleAsync();
        var version = await db.TblContractVersions.SingleAsync();
        contract.TemplateVersionId = 0;
        contract.EditorSourceDocumentId = Guid.NewGuid();
        version.TemplateVersionId = 0;
        version.DocumentMode = 1;
        db.TblContractTemplates.RemoveRange(db.TblContractTemplates);
        db.TblContractTemplateVersions.RemoveRange(db.TblContractTemplateVersions);
        await db.SaveChangesAsync();
        var service = CreateService(db, docx);
        var hash = await service.CaptureEditorBindingHashAsync(ContractId, OwnerId);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.RenderAsync(ContractId, OwnerId));
        db.Add(new ContractVersionEditorDocument { VersionId = VersionId, ContractId = ContractId,
            EditorDocumentId = contract.EditorSourceDocumentId.Value, EditorRevision = 1, Title = "Word gốc",
            Docx = docx, DocxHash = Convert.ToHexString(SHA256.HashData(docx)), BusinessHash = hash });
        await db.SaveChangesAsync();
        var artifact = await service.RenderAsync(ContractId, OwnerId);
        Assert.Equal(0, artifact.TemplateVersionId);
        Assert.Equal(docx, artifact.DocxContent);
    }

    private static ContractEditorBindingController BindingApi(DbDtctechContext db, byte[] source, int tenantId = 1)
    {
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(tenantId, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new BindingSession() }; http.Session.SetInt32("EmployeeId", OwnerId);
        return new(db, tenant, new ContractResourceAuthorizationService(db), CreateService(db, source),
            new CapturingPdfRenderer(), new ContractAuditWriter(db, tenant, new HttpContextAccessor { HttpContext = http }))
            { ControllerContext = new ControllerContext { HttpContext = http } };
    }

    private static async Task<Guid> SeedBindingDraft(DbDtctechContext db)
    {
        var id = Guid.NewGuid();
        db.Add(new ContractEditorDocument { Id = id, TenantId = 1, EmployeeId = OwnerId, Revision = 1, Title = "Reviewed document" });
        db.Add(new ContractEditorRevision { DocumentId = id, Revision = 1, Title = "Reviewed document", Content = RichText("Nội dung chính thức đã rà soát") });
        await db.SaveChangesAsync();
        return id;
    }

    [Fact]
    public async Task BindingEndpoint_StoresIndependentDocumentAndAudit_ThenOfficialRendererUsesIt()
    {
        await using var db = CreateContext(); var source = CreateSourceDocument(); await SeedAsync(db, source);
        var id = await SeedBindingDraft(db);
        var api = BindingApi(db, source);
        Assert.IsType<OkObjectResult>(await api.Bind(ContractId, VersionId, new() { DocumentId = id, Revision = 1, Reviewed = true, ContractRowVersion = (await db.TblContracts.SingleAsync()).RowVersion, VersionRowVersion = (await db.TblContractVersions.SingleAsync()).RowVersion }, default));
        var pin = await db.Set<ContractVersionEditorDocument>().SingleAsync();
        Assert.Equal(1, (await db.TblContractVersions.SingleAsync()).DocumentMode);
        Assert.NotEmpty(pin.Docx); Assert.Equal(Convert.ToHexString(SHA256.HashData(pin.Docx)), pin.DocxHash);
        Assert.Contains("Ghim tài liệu", (await db.TblContractAudits.SingleAsync()).Reason);
        (await db.Set<ContractEditorRevision>().SingleAsync()).Content = RichText("Bản nháp khác về sau");
        (await db.Set<ContractEditorDocument>().SingleAsync()).IsArchived = true;
        await db.SaveChangesAsync();
        Assert.Equal(pin.Docx, (await CreateService(db, source).RenderAsync(ContractId, OwnerId)).DocxContent);
        Assert.IsType<OkObjectResult>(await api.Read(ContractId, VersionId, default));
    }

    [Theory]
    [InlineData("unreviewed")]
    [InlineData("stale-revision")]
    [InlineData("stale-token")]
    [InlineData("submitted")]
    [InlineData("other-tenant")]
    public async Task BindingEndpoint_RejectsUnreviewedStaleLockedSubmittedOrCrossTenantDocument(string scenario)
    {
        await using var db = CreateContext(); var source = CreateSourceDocument(); await SeedAsync(db, source);
        var id = await SeedBindingDraft(db);
        if (scenario == "submitted") db.Add(new TblContractApprovalRequest { ContractId = ContractId, VersionId = VersionId, RowVersion = [1] });
        await db.SaveChangesAsync();
        var result = await BindingApi(db, source, scenario == "other-tenant" ? 2 : 1).Bind(ContractId, VersionId,
            new() { DocumentId = id, Revision = scenario == "stale-revision" ? 2 : 1, Reviewed = scenario != "unreviewed", ContractRowVersion = scenario == "stale-token" ? [9] : (await db.TblContracts.SingleAsync()).RowVersion, VersionRowVersion = (await db.TblContractVersions.SingleAsync()).RowVersion }, default);
        if (scenario == "unreviewed") Assert.IsType<BadRequestObjectResult>(result);
        else if (scenario == "other-tenant") Assert.IsType<NotFoundResult>(result);
        else Assert.IsType<ConflictObjectResult>(result);
        Assert.Empty(db.Set<ContractVersionEditorDocument>());
    }

    private sealed class BindingSession : ISession
    {
        private readonly Dictionary<string, byte[]> values = []; public bool IsAvailable => true; public string Id => "binding-test"; public IEnumerable<string> Keys => values.Keys;
        public void Clear() => values.Clear(); public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask; public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Remove(string key) => values.Remove(key); public void Set(string key, byte[] value) => values[key] = value; public bool TryGetValue(string key, out byte[] value) => values.TryGetValue(key, out value!);
    }

    [Theory]
    [InlineData(2, false, 1, false)]
    [InlineData(1, true, 1, false)]
    [InlineData(1, false, 99, false)]
    [InlineData(1, false, 1, true)]
    public void EditorPin_RejectsSubmittedLockedOldVersionAndStaleToken(byte status, bool locked, int currentVersion, bool stale)
    {
        var contract = new TblContract { ContractId = 2, CurrentVersionId = currentVersion, Status = status, RowVersion = [1] };
        var version = new TblContractVersion { ContractId = 2, VersionId = 1, IsLocked = locked, RowVersion = [2] };
        Assert.Throws<InvalidOperationException>(() => ContractEditorBindingPolicy.RequireMutableVersion(contract, version, stale ? [9] : [1], [2]));
    }

    [Fact]
    public async Task EditorPin_PreviewAndSubmissionUseExactPinnedBytes_NotTemplateOrLiveDraft()
    {
        await using var db = CreateContext();
        var source = CreateSourceDocument();
        await SeedAsync(db, source);
        var pdf = new CapturingPdfRenderer();
        var service = CreateService(db, source, pdf);
        var businessHash = await service.CaptureEditorBindingHashAsync(ContractId, OwnerId);
        var official = source.ToArray();
        var version = await db.TblContractVersions.SingleAsync();
        version.DocumentMode = 1;
        db.Add(new ContractVersionEditorDocument { VersionId = VersionId, ContractId = ContractId,
            EditorDocumentId = Guid.NewGuid(), EditorRevision = 3, Title = "Official reviewed text",
            Docx = official, DocxHash = Convert.ToHexString(SHA256.HashData(official)), BusinessHash = businessHash });
        await db.SaveChangesAsync();
        // No live editor document/revision exists: the official version must be independent.
        Assert.Equal(official, (await service.GenerateDocxAsync(ContractId, OwnerId)).Content);
        var submitted = await service.RenderAsync(ContractId, OwnerId);
        Assert.Equal(official, submitted.DocxContent);
        Assert.Equal(official, pdf.InputDocx);
    }

    [Fact]
    public async Task EditorPin_BusinessChangeBlocksPreviewAndSubmission_NoFallback()
    {
        await using var db = CreateContext();
        var source = CreateSourceDocument();
        await SeedAsync(db, source);
        var service = CreateService(db, source);
        var hash = await service.CaptureEditorBindingHashAsync(ContractId, OwnerId);
        (await db.TblContractVersions.SingleAsync()).DocumentMode = 1;
        db.Add(new ContractVersionEditorDocument { VersionId = VersionId, ContractId = ContractId,
            Docx = source, DocxHash = Convert.ToHexString(SHA256.HashData(source)), BusinessHash = hash });
        (await db.TblContracts.SingleAsync()).ContractName += " changed";
        await db.SaveChangesAsync();
        Assert.Contains("ghim lại", (await Assert.ThrowsAsync<InvalidOperationException>(() => service.GenerateDocxAsync(ContractId, OwnerId))).Message);
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.RenderAsync(ContractId, OwnerId));
    }

    [Fact]
    public async Task EditorPin_DraftToNegotiatingDoesNotInvalidateReviewedContents()
    {
        await using var db = CreateContext();
        var source = CreateSourceDocument();
        await SeedAsync(db, source);
        var contract = await db.TblContracts.SingleAsync();
        contract.Status = (byte)ContractStatus.Draft;
        await db.SaveChangesAsync();
        var service = CreateService(db, source);
        var before = await service.CaptureEditorBindingHashAsync(ContractId, OwnerId);
        contract.Status = (byte)ContractStatus.Negotiating;
        await db.SaveChangesAsync();
        Assert.Equal(before, await service.CaptureEditorBindingHashAsync(ContractId, OwnerId));
    }

    [Theory]
    [InlineData("missing")]
    [InlineData("corrupt")]
    [InlineData("other-version")]
    public void EditorPin_InvalidPinIsRejected(string scenario)
    {
        var bytes = new byte[] { 1, 2, 3 };
        var pin = scenario == "missing" ? null : new ContractVersionEditorDocument { VersionId = scenario == "other-version" ? 99 : 1,
            ContractId = 2, BusinessHash = "business", Docx = bytes,
            DocxHash = scenario == "corrupt" ? "bad" : Convert.ToHexString(SHA256.HashData(bytes)) };
        Assert.Throws<InvalidOperationException>(() => ContractEditorBindingPolicy.RequireDocument(new() { VersionId = 1, ContractId = 2 }, pin, "business"));
    }
}
