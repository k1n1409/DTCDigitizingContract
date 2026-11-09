using System.ComponentModel.DataAnnotations;
using System.Data;
using System.Text.Json;
using ContractManagement.API.Common.Enums;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.Common.Enums;
using ContractManagement.Domains.Interfaces.Contract;
using ContractManagement.Domains.Policies.ContractTemplate;
using ContractManagement.Filter;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController, Route("api/administrative-text/{target}/{id:int}")]
[SessionAuthorize(RbacPermissions.ContractTextCorrect)]
public sealed class AdministrativeTextController(DbDtctechContext db, ICurrentTenant tenant,
    IContractResourceAuthorizationService authorization, IContractAuditWriter audit) : ControllerBase
{
    public sealed record TextRow(int Id, string Kind, string Code, string? Title, string? TitleEn,
        string? ContentVi, string? ContentEn, byte BilingualMode, string RowVersion);
    public sealed class EditRequest
    {
        [Range(1, int.MaxValue)] public int VersionId { get; set; }
        [Range(1, int.MaxValue)] public int RowId { get; set; }
        [Required] public string Kind { get; set; } = "";
        [Required] public string ParentRowVersion { get; set; } = "";
        [Required] public string RowVersion { get; set; } = "";
        [MaxLength(300)] public string? Title { get; set; }
        [MaxLength(300)] public string? TitleEn { get; set; }
        public string? ContentVi { get; set; }
        public string? ContentEn { get; set; }
        [Required, MaxLength(1000)] public string Reason { get; set; } = "";
        public bool Confirmed { get; set; }
    }
    private int Actor => HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException();
    private async Task CheckPermission(CancellationToken ct)
    {
        var role = await db.TblEmployees.AsNoTracking().Where(x => x.EmployeeId == Actor && x.Status == 1).Select(x => (byte?)x.EmployeeType).SingleOrDefaultAsync(ct);
        if (!EmployeePermissionCatalog.HasPermission(role, RbacPermissions.ContractTextCorrect))
            throw new RbacOperationException(403, AuthorizationErrorCodes.PermissionDenied, "Chỉ Hành chính hoặc Manager có quyền sửa trực tiếp căn cứ/điều khoản.");
    }
    private async Task<(object Parent, int VersionId, int VersionNo, byte Language)> Parent(string target, int id, CancellationToken ct)
    {
        if (target == "contract")
        {
            await authorization.EnsureCanReadAsync(id, Actor, ct);
            var contract = await db.TblContracts.SingleAsync(x => x.ContractId == id, ct);
            if (contract.Status is not (3 or 4 or 5)) throw new InvalidOperationException("Chức năng này chỉ dùng cho hợp đồng đã duyệt/chờ ký, đã ký hoặc hoàn thành.");
            var version = await db.TblContractVersions.SingleAsync(x => x.VersionId == contract.CurrentVersionId && x.ContractId == id, ct);
            if (!version.IsLocked) throw new InvalidOperationException("Phiên bản hợp đồng chưa khóa; hãy dùng chức năng chỉnh sửa thông thường.");
            return (contract, version.VersionId, version.VersionNo, contract.LanguageMode);
        }
        if (target == "template")
        {
            var version = await db.TblContractTemplateVersions.SingleOrDefaultAsync(x => x.TemplateVersionId == id, ct) ?? throw new KeyNotFoundException();
            if (version.Status != (byte)TemplateVersionStatus.Published) throw new InvalidOperationException("Chỉ sửa trực tiếp mẫu đang phát hành. Mẫu nháp dùng trình sửa thông thường.");
            var template = await db.TblContractTemplates.AsNoTracking().SingleAsync(x => x.TemplateId == version.TemplateId, ct);
            return (version, version.TemplateVersionId, version.VersionNo, template.LanguageMode);
        }
        throw new ArgumentException("Đối tượng chỉnh sửa không hợp lệ.");
    }
    private string Token(object entity) => Convert.ToBase64String((byte[])db.Entry(entity).Property("RowVersion").CurrentValue!);
    private void Match(object entity, string expected)
    {
        byte[] bytes;
        try { bytes = Convert.FromBase64String(expected); } catch (FormatException) { throw new ArgumentException("Token chỉnh sửa không hợp lệ."); }
        var entry = db.Entry(entity);
        if (bytes.Length == 0 || !((byte[])entry.Property("RowVersion").CurrentValue!).SequenceEqual(bytes))
            throw new DbUpdateConcurrencyException("Dữ liệu vừa thay đổi. Tải lại trước khi lưu.");
        entry.Property("RowVersion").OriginalValue = bytes;
    }
    private TextRow Row(object entity, string kind)
    {
        var e = db.Entry(entity); var term = kind == "term";
        string? S(string name) => e.Property(name).CurrentValue as string;
        var key = entity switch { TblContractTerm => "TermId", TblContractTemplateTerm => "TemplateTermId", TblContractLegalBasis => "LegalBasisId", _ => "TemplateLegalBasisId" };
        return new((int)e.Property(key).CurrentValue!, kind, S(term ? "TermCode" : "BasisCode")!, term ? S("TermTitle") : null,
            term ? S("TermTitleEn") : null, S(term ? "TermContent" : "ContentVi"), S(term ? "TermContentEn" : "ContentEn"),
            term ? (byte)e.Property("BilingualContentMode").CurrentValue! : (byte)1, Token(entity));
    }
    [HttpGet]
    public async Task<IActionResult> Get(string target, int id, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store"; await CheckPermission(ct);
        var parent = await Parent(target, id, ct);
        var rows = new List<TextRow>();
        if (target == "contract")
        {
            rows.AddRange((await db.TblContractLegalBases.Where(x => x.ContractId == id && x.VersionId == parent.VersionId).OrderBy(x => x.DisplayOrder).ToListAsync(ct)).Select(x => Row(x, "basis")));
            rows.AddRange((await db.TblContractTerms.Where(x => x.ContractId == id && x.VersionId == parent.VersionId).OrderBy(x => x.DisplayOrder).ToListAsync(ct)).Select(x => Row(x, "term")));
        }
        else
        {
            rows.AddRange((await db.TblContractTemplateLegalBases.Where(x => x.TemplateVersionId == id).OrderBy(x => x.DisplayOrder).ToListAsync(ct)).Select(x => Row(x, "basis")));
            rows.AddRange((await db.TblContractTemplateTerms.Where(x => x.TemplateVersionId == id).OrderBy(x => x.DisplayOrder).ToListAsync(ct)).Select(x => Row(x, "term")));
        }
        var tenantId = tenant.GetRequiredTenant().TenantId;
        var history = await db.Set<AdministrativeTextEdit>().AsNoTracking().Where(x => x.TenantId == tenantId && x.Target == target && x.ParentId == id && x.VersionId == parent.VersionId)
            .OrderByDescending(x => x.AdministrativeTextEditId).Take(20).Select(x => new { x.AdministrativeTextEditId, x.Kind, x.RowId, x.Reason, x.EmployeeId, EmployeeName = db.TblEmployees.Where(e => e.EmployeeId == x.EmployeeId).Select(e => e.EmployeeFullName).FirstOrDefault(), x.CreatedAtUtc, x.BeforeJson, x.AfterJson }).ToListAsync(ct);
        return Ok(ApiResponse<object>.Ok(new { parent.VersionId, parent.VersionNo, languageMode = parent.Language, parentRowVersion = Token(parent.Parent), rows, history }));
    }
    [HttpPost, RequestSizeLimit(2 * 1024 * 1024)]
    public async Task<IActionResult> Edit(string target, int id, EditRequest request, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store"; await CheckPermission(ct);
        if (!request.Confirmed || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 1000 || request.Kind is not ("term" or "basis"))
            return BadRequest(ApiResponse<object>.Fail("Cần xác nhận, chọn loại nội dung và nhập lý do (tối đa 1000 ký tự)."));
        return await db.Database.CreateExecutionStrategy().ExecuteAsync<IActionResult>(async () =>
        {
            await using var tx = db.Database.IsRelational() ? await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct) : await db.Database.BeginTransactionAsync(ct);
            try
            {
                var parent = await Parent(target, id, ct);
                if (parent.VersionId != request.VersionId) throw new DbUpdateConcurrencyException("Version hiện hành đã thay đổi.");
                Match(parent.Parent, request.ParentRowVersion);
                object? entity = (target, request.Kind) switch {
                    ("contract", "term") => await db.TblContractTerms.SingleOrDefaultAsync(x => x.TermId == request.RowId && x.ContractId == id && x.VersionId == parent.VersionId, ct),
                    ("contract", "basis") => await db.TblContractLegalBases.SingleOrDefaultAsync(x => x.LegalBasisId == request.RowId && x.ContractId == id && x.VersionId == parent.VersionId, ct),
                    ("template", "term") => await db.TblContractTemplateTerms.SingleOrDefaultAsync(x => x.TemplateTermId == request.RowId && x.TemplateVersionId == id, ct),
                    _ => await db.TblContractTemplateLegalBases.SingleOrDefaultAsync(x => x.TemplateLegalBasisId == request.RowId && x.TemplateVersionId == id, ct)
                };
                if (entity is null) return NotFound();
                Match(entity, request.RowVersion);
                var before = Row(entity, request.Kind);
                if (!ContractTermRichText.TryParse(request.ContentVi, out _) || string.IsNullOrWhiteSpace(request.ContentVi))
                    throw new ArgumentException("Nội dung tiếng Việt phải là văn bản soạn thảo hợp lệ.");
                if (!string.IsNullOrWhiteSpace(request.ContentEn) && !ContractTermRichText.TryParse(request.ContentEn, out _))
                    throw new ArgumentException("Nội dung tiếng Anh không hợp lệ.");
                if (request.Kind == "term")
                {
                    if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 300 || request.TitleEn?.Length > 300)
                        throw new ArgumentException("Tiêu đề bắt buộc và tối đa 300 ký tự.");
                    BilingualContentPolicy.Validate(before.BilingualMode, (ContractLanguageMode)parent.Language, request.TitleEn, request.ContentVi, request.ContentEn, before.Code, requireBody: true);
                }
                else
                {
                    if (!BilingualContentPolicy.HasContent(request.ContentVi)) throw new ArgumentException("Căn cứ tiếng Việt không được để trống.");
                    if (parent.Language == (byte)ContractLanguageMode.Bilingual && !BilingualContentPolicy.HasContent(request.ContentEn))
                        throw new ArgumentException("Căn cứ song ngữ cần nội dung tiếng Anh.");
                }
                var entry = db.Entry(entity); var term = request.Kind == "term";
                if (term) { entry.Property("TermTitle").CurrentValue = request.Title!.Trim(); entry.Property("TermTitleEn").CurrentValue = request.TitleEn?.Trim(); }
                entry.Property(term ? "TermContent" : "ContentVi").CurrentValue = request.ContentVi;
                entry.Property(term ? "TermContentEn" : "ContentEn").CurrentValue = request.ContentEn;
                var now = DateTime.UtcNow;
                entry.Property("UpdatedEmployeeId").CurrentValue = Actor; entry.Property("UpdatedDate").CurrentValue = now;
                db.Entry(parent.Parent).Property(target == "contract" ? "UpdateDate" : "UpdatedDate").CurrentValue = now;
                db.Entry(parent.Parent).Property(target == "contract" ? "UpdateDate" : "UpdatedDate").IsModified = true;
                db.Entry(parent.Parent).Property("UpdatedEmployeeId").CurrentValue = Actor;
                var log = new AdministrativeTextEdit { TenantId = tenant.GetRequiredTenant().TenantId, Target = target, ParentId = id,
                    VersionId = parent.VersionId, Kind = request.Kind, RowId = request.RowId, Reason = request.Reason.Trim(),
                    EmployeeId = Actor, CreatedAtUtc = now, BeforeJson = JsonSerializer.Serialize(before), AfterJson = JsonSerializer.Serialize(Row(entity, request.Kind)) };
                db.Add(log);
                using (target == "contract" ? db.BeginAdministrativeTextCorrection(parent.VersionId) : null)
                    await db.SaveChangesAsync(ct);
                if (target == "contract")
                {
                    audit.StageEmployeeAudits([new(id, parent.VersionId, Actor, ContractAuditActionTypes.ContractTextCorrected,
                        ContractAuditResults.Succeeded, now, Reason: $"Sửa trực tiếp {request.Kind} {before.Code}; bản ghi #{log.AdministrativeTextEditId}: {request.Reason.Trim()}",
                        SubjectType: ContractAuditSubjectTypes.ContractVersion, SubjectId: parent.VersionId)]);
                    await db.SaveChangesAsync(ct);
                }
                await tx.CommitAsync(ct);
                return Ok(ApiResponse<object>.Ok(new { editId = log.AdministrativeTextEditId }, "Đã sửa trực tiếp trên version hiện tại; file đã duyệt/ký được giữ nguyên."));
            }
            catch { await tx.RollbackAsync(ct); db.ChangeTracker.Clear(); throw; }
        });
    }
}
