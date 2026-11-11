using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Security.Cryptography;
using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.Domains.Interfaces.Contract;
using ContractManagement.Domains.Interfaces.ContractTemplate;
using ContractManagement.Domains.Services.Contract;
using ContractManagement.Filter;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController, Route("api/contracts/{contractId:int}/versions/{versionId:int}/editor-document")]
[SessionAuthorize]
public sealed class ContractEditorBindingController(DbDtctechContext db, ICurrentTenant tenant,
    IContractResourceAuthorizationService authorization, ContractDocumentPreviewService preview,
    IContractTemplatePdfRenderer pdf, IContractAuditWriter audit) : ControllerBase
{
    private int Actor => HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException();

    public sealed class BindRequest
    {
        public Guid DocumentId { get; set; }
        [Range(1, int.MaxValue)] public int Revision { get; set; }
        [Required] public byte[] ContractRowVersion { get; set; } = [];
        [Required] public byte[] VersionRowVersion { get; set; } = [];
        [StringLength(64, MinimumLength = 64)] public string? ReviewedBusinessHash { get; set; }
        public bool Reviewed { get; set; }
    }

    [HttpGet]
    public async Task<IActionResult> Read(int contractId, int versionId, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        await authorization.EnsureCanReadAsync(contractId, Actor, ct);
        var version = await db.TblContractVersions.AsNoTracking().SingleOrDefaultAsync(x => x.VersionId == versionId && x.ContractId == contractId, ct);
        if (version is null) return NotFound();
        var stored = await db.Set<ContractVersionEditorDocument>().AsNoTracking().Where(x => x.VersionId == versionId && x.ContractId == contractId)
            .Select(x => new { x.EditorDocumentId, x.EditorRevision, x.Title, x.DocxHash, x.BoundAtUtc, x.BusinessHash, x.BusinessReviewSnapshot }).SingleOrDefaultAsync(ct);
        var pin = stored is null ? null : new { stored.EditorDocumentId, stored.EditorRevision, stored.Title, stored.DocxHash, stored.BoundAtUtc };
        bool? matchesBusinessData = null;
        string? currentBusinessHash = null;
        Guid? editableDocumentId = null;
        ContractEditorBindingReview.Difference? difference = null;
        if (!version.IsLocked && await db.TblContracts.AnyAsync(x => x.ContractId == contractId && x.CurrentVersionId == versionId && (x.Status == 0 || x.Status == 1), ct))
        {
            try
            {
                // With no pin the dialog requests a capture explicitly so ordinary template details
                // don't pay for a snapshot they won't use.
                if (version.DocumentMode == 1 || Request.Query.ContainsKey("review"))
                {
                    var capture = await preview.CaptureEditorBindingAsync(contractId, Actor, ct);
                    if (capture.VersionId == versionId)
                    {
                        currentBusinessHash = capture.BusinessHash;
                        if (stored is not null)
                        {
                            matchesBusinessData = stored.BusinessHash == capture.BusinessHash;
                            if (matchesBusinessData == false)
                                difference = ContractEditorBindingReview.Compare(stored.BusinessReviewSnapshot, capture.ReviewSnapshot);
                        }
                    }
                }
                var sourceId = stored?.EditorDocumentId ?? (version.DocumentMode == 1
                    ? await db.TblContracts.Where(x => x.ContractId == contractId).Select(x => x.EditorSourceDocumentId).SingleAsync(ct)
                    : null);
                if (currentBusinessHash is not null && sourceId is Guid id)
                {
                    var tenantId = tenant.GetRequiredTenant().TenantId;
                    if (await db.Set<ContractEditorDocument>().AnyAsync(x => x.Id == id && x.TenantId == tenantId && !x.IsArchived
                        && (x.EmployeeId == Actor || (x.IsTemplate && x.IsSharedTemplate)), ct))
                        editableDocumentId = id;
                }
            }
            catch (RbacOperationException) { }
        }
        return Ok(ApiResponse<object>.Ok(new { version.DocumentMode, version.IsLocked, pin, matchesBusinessData, difference, editableDocumentId, currentBusinessHash }));
    }

    [HttpPost, SessionAuthorize(RbacPermissions.ContractCreate)]
    public async Task<IActionResult> Bind(int contractId, int versionId, BindRequest request, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (!request.Reviewed || request.ContractRowVersion.Length == 0 || request.VersionRowVersion.Length == 0)
            return BadRequest(ApiResponse<object>.Fail("Cần rà soát nội dung Word/PDF và dữ liệu nghiệp vụ trước khi ghim tài liệu."));
        await authorization.EnsureCanWriteAsync(contractId, Actor, ct);
        var tenantId = tenant.GetRequiredTenant().TenantId;
        var source = await db.Set<ContractEditorDocument>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.DocumentId && x.TenantId == tenantId && !x.IsArchived && (x.EmployeeId == Actor || (x.IsTemplate && x.IsSharedTemplate)), ct);
        if (source is null) return NotFound();
        if (source.Revision != request.Revision) return Conflict(ApiResponse<object>.Fail("Tài liệu đã có bản mới. Lưu và rà soát lại trước khi ghim."));
        var revision = await db.Set<ContractEditorRevision>().AsNoTracking().SingleAsync(x => x.DocumentId == source.Id && x.Revision == request.Revision, ct);
        var bindings = JsonSerializer.Deserialize<Dictionary<string, string>>(revision.Bindings) ?? [];
        var editor = new ContractDocumentEditorController(pdf, db, tenant) { ControllerContext = ControllerContext };
        var exported = await editor.Export("docx", new() { Content = revision.Content, Title = revision.Title, Bindings = bindings }, ct);
        if (exported is not FileContentResult file) return exported;

        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var tx = db.Database.IsRelational()
                ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct)
                : await db.Database.BeginTransactionAsync(ct);
            var contract = await db.TblContracts.SingleAsync(x => x.ContractId == contractId, ct);
            var version = await db.TblContractVersions.SingleOrDefaultAsync(x => x.VersionId == versionId && x.ContractId == contractId, ct);
            if (version is null) return NotFound();
            try { ContractEditorBindingPolicy.RequireMutableVersion(contract, version, request.ContractRowVersion, request.VersionRowVersion); }
            catch (InvalidOperationException e) { return Conflict(ApiResponse<object>.Fail(e.Message)); }
            if (await db.TblContractApprovalRequests.AnyAsync(x => x.ContractId == contractId && x.VersionId == versionId, ct)
                || await db.TblFileStorages.AnyAsync(x => x.ObjectType == "ContractVersionArtifact" && x.ObjectId == versionId, ct))
                return Conflict(ApiResponse<object>.Fail("Version đã từng gửi duyệt hoặc đã có artifact chính thức. Không ghi đè tài liệu; hãy tạo version mới."));
            foreach (var pair in new[] { ("SOURCE_CUSTOMER_ID", contract.CustomerId), ("SOURCE_EMPLOYEE_ID", contract.EmployeeId) })
                if (bindings.TryGetValue(pair.Item1, out var value) && (!int.TryParse(value, out var selected) || selected != pair.Item2))
                    return BadRequest(ApiResponse<object>.Fail("Khách hàng/nhân viên của tài liệu không khớp hợp đồng. Cập nhật nguồn dữ liệu trước."));
            var binding = await preview.CaptureEditorBindingAsync(contractId, Actor, ct);
            if (binding.VersionId != versionId || (request.ReviewedBusinessHash is not null && request.ReviewedBusinessHash != binding.BusinessHash))
                return Conflict(ApiResponse<object>.Fail("Dữ liệu hợp đồng vừa thay đổi. Mở lại phần rà soát và xác nhận trước khi cập nhật Word."));
            var pin = await db.Set<ContractVersionEditorDocument>().SingleOrDefaultAsync(x => x.VersionId == versionId, ct);
            if (pin is null) { pin = new() { VersionId = versionId, ContractId = contractId }; db.Add(pin); }
            pin.EditorDocumentId = source.Id; pin.EditorRevision = revision.Revision; pin.Title = revision.Title;
            pin.Docx = file.FileContents; pin.DocxHash = Convert.ToHexString(SHA256.HashData(file.FileContents));
            pin.BusinessHash = binding.BusinessHash; pin.BusinessReviewSnapshot = binding.ReviewSnapshot;
            pin.BoundByEmployeeId = Actor; pin.BoundAtUtc = DateTime.UtcNow;
            version.DocumentMode = 1;
            db.Entry(version).Property(x => x.DocumentMode).IsModified = true;
            contract.UpdateDate = DateTime.UtcNow; contract.UpdatedEmployeeId = Actor;
            audit.StageEmployeeAudits([new EmployeeContractAuditWriteRequest(contractId, versionId, Actor,
                ContractAuditActionTypes.DraftUpdated, ContractAuditResults.Succeeded, DateTime.UtcNow,
                Reason: $"Ghim tài liệu soạn thảo revision {revision.Revision}; SHA-256 {pin.DocxHash}",
                SubjectType: ContractAuditSubjectTypes.ContractVersion, SubjectId: versionId)]);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return Ok(ApiResponse<object>.Ok(new { contract.RowVersion, versionRowVersion = version.RowVersion, pin.DocxHash, pin.EditorRevision }, "Đã ghim tài liệu chính thức vào version hợp đồng."));
        });
    }
}
