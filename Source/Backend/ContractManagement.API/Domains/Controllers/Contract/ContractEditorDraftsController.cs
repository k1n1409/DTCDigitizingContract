using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.RegularExpressions;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Common.Security;
using ContractManagement.Filter;
using ContractManagement.Domains.Policies.ContractTemplate;
using ContractManagement.Infrastructure.MultiTenancy.Interfaces;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ContractManagement.API.Domains.Services.Contract;

namespace ContractManagement.API.Domains.Controllers.Contract;

[ApiController, Route("api/contract-editor-drafts")]
[SessionAuthorize(RbacPermissions.ContractCreate)]
public sealed class ContractEditorDraftsController(DbDtctechContext db, ICurrentTenant tenant, ContractManagement.Domains.Interfaces.ContractTemplate.IContractTemplatePdfRenderer? pdf = null) : ControllerBase
{
    public sealed class SaveRequest
    {
        [Required, MaxLength(100)] public string Title { get; set; } = "";
        public string Content { get; set; } = "";
        public int ExpectedRevision { get; set; }
        public Guid? ClientDocumentId { get; set; }
        public bool IsTemplate { get; set; }
        public bool IsSharedTemplate { get; set; } = true;
        public Dictionary<string, string> Bindings { get; set; } = [];
    }
    private int Actor => HttpContext.Session.GetInt32("EmployeeId") ?? throw new UnauthorizedAccessException();
    private IQueryable<ContractEditorDocument> Readable => db.Set<ContractEditorDocument>().Where(x => x.TenantId == tenant.GetRequiredTenant().TenantId && !x.IsArchived && (x.EmployeeId == Actor || (x.IsTemplate && x.IsSharedTemplate)));
    private async Task<bool> CanManageTemplates(CancellationToken ct) => EmployeePermissionCatalog.HasPermission(await db.TblEmployees.AsNoTracking().Where(x => x.EmployeeId == Actor && x.Status == 1).Select(x => x.EmployeeType).SingleOrDefaultAsync(ct), RbacPermissions.TemplateManage);

    public sealed class CreateDraftFromEditorRequest
    {
        [Range(1, int.MaxValue)] public int Revision { get; set; }
        public bool Reviewed { get; set; }
        [Required] public ContractManagement.API.Domains.DTOs.Requests.Contract.CreateContractRequest Contract { get; set; } = new();
    }

    [HttpPost("{id:guid}/create-contract")]
    public async Task<IActionResult> CreateContract(Guid id, CreateDraftFromEditorRequest request, [FromServices] ContractManagement.Domains.Interfaces.Contract.IContractService contracts, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        if (!request.Reviewed) return BadRequest(ApiResponse<object>.Fail("Cần xác nhận rà soát tài liệu và dữ liệu hợp đồng."));
        var document = await Readable.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (document is null) return NotFound();
        if (request.Contract.TemplateVersionId == 0 && document.IsTemplate)
            return BadRequest(ApiResponse<object>.Fail("Hãy bấm Dùng mẫu và lưu bản sao đã rà soát trước khi tạo hợp đồng."));
        if (document.Revision != request.Revision) return Conflict(ApiResponse<object>.Fail("Tài liệu đã có phiên bản mới. Mở lại tài liệu và rà soát trước khi tạo Draft."));
        var revision = await db.Set<ContractEditorRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == request.Revision, ct);
        if (revision is null) return NotFound();
        var bindings = JsonSerializer.Deserialize<Dictionary<string, string>>(revision.Bindings) ?? [];
        foreach (var pair in new[] { ("SOURCE_CUSTOMER_ID", request.Contract.CustomerId), ("SOURCE_EMPLOYEE_ID", request.Contract.ResponsibleEmployeeId ?? Actor) })
            if (bindings.TryGetValue(pair.Item1, out var sourceId) && (!int.TryParse(sourceId, out var selectedId) || selectedId != pair.Item2))
                return BadRequest(ApiResponse<object>.Fail("Khách hàng/nhân viên đã khác dữ liệu liên kết trong tài liệu. Quay lại soạn thảo để cập nhật nguồn trước."));
        if (pdf is null) return StatusCode(503, ApiResponse<object>.Fail("Chưa cấu hình bộ xuất tài liệu."));
        var editor = new ContractDocumentEditorController(pdf, db, tenant) { ControllerContext = ControllerContext };
        var exported = await editor.Export("docx", new() { Content = revision.Content, Title = revision.Title, Bindings = bindings }, ct);
        if (exported is not FileContentResult file) return exported;
        request.Contract.EditorSourceDocumentId = id;
        request.Contract.EditorSourceRevision = revision.Revision;
        request.Contract.EditorSourceTitle = revision.Title;
        request.Contract.EditorSourceDocx = file.FileContents;
        var result = await contracts.CreateAsync(request.Contract, Actor);
        return Created($"/api/contracts/{result.ContractId}", ApiResponse<ContractManagement.API.Domains.DTOs.Responses.Contract.CreateContractResponse>.Ok(result, "Đã tạo Draft và gắn tài liệu chính thức vào version đầu tiên."));
    }

    [HttpGet("binding-values")]
    public async Task<IActionResult> BindingValues(string source, int id, CancellationToken ct)
    {
        Response.Headers.CacheControl = "no-store";
        Dictionary<string, string?> values;
        switch (source)
        {
            case "provider":
                var profile = await db.TblTenantLegalProfiles.AsNoTracking().SingleOrDefaultAsync(x => x.TenantLegalProfileId == 1, ct);
                if (profile is null) return NotFound(ApiResponse<object>.Fail("Chưa có hồ sơ pháp lý công ty trong tenant. Hãy cập nhật Hồ sơ pháp lý trước."));
                values = new() {
                    ["PROVIDER_NAME"] = profile.LegalEntityName, ["PROVIDER_TAX_CODE"] = profile.TaxCode,
                    ["PROVIDER_ADDRESS"] = profile.Address, ["PROVIDER_REPRESENTATIVE"] = profile.RepresentativeName,
                    ["PROVIDER_TITLE"] = profile.RepresentativeTitle, ["PROVIDER_PHONE"] = profile.PhoneNumber,
                    ["PROVIDER_FAX"] = profile.FaxNumber, ["PROVIDER_BANK_ACCOUNT_NUMBER"] = profile.BankAccountNumber,
                    ["PROVIDER_BANK_NAME"] = profile.BankName, ["SOURCE_PROVIDER_ID"] = "1"
                };
                break;
            case "customer":
                var customer = await db.TblCustomers.AsNoTracking().SingleOrDefaultAsync(x => x.CustomerId == id && x.Status == 1, ct);
                if (customer is null) return NotFound();
                values = new() { ["CUSTOMER_NAME"] = customer.CustomerCompany ?? customer.CustomerFullName, ["CUSTOMER_TAX_CODE"] = customer.CustomerTaxCode, ["CUSTOMER_ADDRESS"] = customer.CustomerAddress, ["CUSTOMER_EMAIL"] = customer.CustomerEmail, ["CUSTOMER_PHONE"] = customer.CustomerMobile ?? customer.CustomerPhone, ["CUSTOMER_REPRESENTATIVE"] = customer.CustomerRepresentativeName, ["CUSTOMER_TITLE"] = customer.CustomerRepresentativeTitle, ["SOURCE_CUSTOMER_ID"] = id.ToString() };
                break;
            case "employee":
                var employee = await db.TblEmployees.AsNoTracking().SingleOrDefaultAsync(x => x.EmployeeId == id && x.Status == 1, ct);
                if (employee is null) return NotFound();
                values = new() { ["EMPLOYEE_NAME"] = employee.EmployeeFullName, ["EMPLOYEE_PHONE"] = employee.EmployeeMobile ?? employee.EmployeePhone, ["EMPLOYEE_EMAIL"] = employee.EmployeeEmail, ["SOURCE_EMPLOYEE_ID"] = id.ToString() };
                break;
            case "product":
                var product = await db.TblProducts.AsNoTracking().SingleOrDefaultAsync(x => x.ProductId == id && x.Status == 1, ct);
                if (product is null) return NotFound();
                values = new() { ["PRODUCT_NAME"] = product.ProductName, ["PRODUCT_CODE"] = product.ProductCode, ["PRODUCT_UNIT"] = product.UnitName, ["PRODUCT_PRICE"] = product.ProductPrice?.ToString("0.####", System.Globalization.CultureInfo.InvariantCulture), ["SOURCE_PRODUCT_ID"] = id.ToString() };
                break;
            default: return BadRequest(ApiResponse<object>.Fail("Nguồn dữ liệu không hợp lệ."));
        }
        return Ok(ApiResponse<object>.Ok(values.ToDictionary(x => x.Key, x => x.Value ?? "")));
    }

    [HttpGet]
    public async Task<IActionResult> List(int page = 1, string? keyword = null, CancellationToken ct = default, bool templates = false)
    {
        page = Math.Max(1, Math.Min(page, 100000));
        var query = Readable.AsNoTracking().Where(x => x.IsTemplate == templates);
        if (!string.IsNullOrWhiteSpace(keyword)) query = query.Where(x => x.Title.Contains(keyword));
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.UpdatedAtUtc).ThenBy(x => x.Id).Skip((page - 1) * 10).Take(10).ToListAsync(ct);
        return Ok(ApiResponse<object>.Ok(new { items, totalCount = total, page, totalPages = Math.Max(1, (int)Math.Ceiling(total / 10d)) }));
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> Read(Guid id, int? revision = null, CancellationToken ct = default)
    {
        var doc = await Readable.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (doc is null) return NotFound();
        var item = await db.Set<ContractEditorRevision>().AsNoTracking().SingleOrDefaultAsync(x => x.DocumentId == id && x.Revision == (revision ?? doc.Revision), ct);
        if (item is null) return NotFound();
        Response.Headers.CacheControl = "no-store";
        return Ok(ApiResponse<object>.Ok(new { doc.Id, doc.IsTemplate, doc.IsSharedTemplate, revision = item.Revision, currentRevision = doc.Revision, item.Title, item.Content, bindings = JsonSerializer.Deserialize<Dictionary<string, string>>(item.Bindings), item.CreatedAtUtc }));
    }

    [HttpGet("{id:guid}/history")]
    public async Task<IActionResult> History(Guid id, int page = 1, CancellationToken ct = default)
    {
        if (!await Readable.AnyAsync(x => x.Id == id, ct)) return NotFound();
        page = Math.Max(1, Math.Min(page, 100000));
        var query = db.Set<ContractEditorRevision>().AsNoTracking().Where(x => x.DocumentId == id);
        var total = await query.CountAsync(ct);
        var items = await query.OrderByDescending(x => x.Revision).Skip((page - 1) * 10).Take(10).Select(x => new { x.Revision, x.Title, x.CreatedAtUtc }).ToListAsync(ct);
        return Ok(ApiResponse<object>.Ok(new { items, totalPages = Math.Max(1, (int)Math.Ceiling(total / 10d)) }));
    }

    [HttpPost, RequestSizeLimit(5 * 1024 * 1024)]
    public Task<IActionResult> Create(SaveRequest request, CancellationToken ct) => Save(null, request, ct);

    [HttpPut("{id:guid}"), RequestSizeLimit(5 * 1024 * 1024)]
    public Task<IActionResult> Update(Guid id, SaveRequest request, CancellationToken ct) => Save(id, request, ct);

    private async Task<IActionResult> Save(Guid? id, SaveRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || (request.Content != "" && !ContractTermRichText.TryParse(request.Content, out _)) || request.Bindings is null || request.Bindings.Count > 200 || request.Bindings.Any(x => !Regex.IsMatch(x.Key, "^[A-Z][A-Z0-9_]{0,79}$") || x.Value is null || x.Value.Length > 10000))
            return BadRequest(ApiResponse<object>.Fail("Nội dung hoặc trường dữ liệu không hợp lệ."));
        ContractTermRichText.TryParse(request.Content, out var parsed);
        if (parsed.Preservation is { } preserved && !await EditorDocxSourceAccess.CanReadAsync(db, tenant.GetRequiredTenant().TenantId, Actor, preserved.SourceId, preserved.Sha256, ct)) return NotFound(ApiResponse<object>.Fail("Không có quyền truy cập Word gốc của tài liệu này."));
        var doc = id.HasValue ? await Readable.SingleOrDefaultAsync(x => x.Id == id, ct) : null;
        if (id.HasValue && doc is null) return NotFound();
        if (doc is not null && doc.SourceAssetId != parsed.Preservation?.SourceId) return BadRequest(ApiResponse<object>.Fail("Nguồn Word gốc không được thay đổi hoặc bỏ khỏi tài liệu đã lưu. Hãy nhập thành tài liệu mới."));
        if (doc is { IsTemplate: false } && doc.EmployeeId != Actor) return NotFound();
        if ((doc is { IsTemplate: true, IsSharedTemplate: true } || (request.IsTemplate && request.IsSharedTemplate)) && !await CanManageTemplates(ct)) return StatusCode(403, ApiResponse<object>.Fail("Bạn không có quyền quản lý mẫu dùng chung."));
        if (doc is not null && doc.IsTemplate != request.IsTemplate) return BadRequest(ApiResponse<object>.Fail("Không đổi loại tài liệu trực tiếp. Hãy lưu thành mẫu mới hoặc tạo bản sao từ mẫu."));
        if (doc is { IsTemplate: true } && doc.IsSharedTemplate != request.IsSharedTemplate) return BadRequest(ApiResponse<object>.Fail("Không đổi phạm vi của mẫu đã lưu. Hãy lưu thành mẫu mới để tránh chia sẻ nhầm dữ liệu."));
        if (!id.HasValue && request.ClientDocumentId.HasValue)
        {
            var existing = await db.Set<ContractEditorDocument>().AsNoTracking().SingleOrDefaultAsync(x => x.Id == request.ClientDocumentId.Value, ct);
            if (existing is not null)
            {
                if (existing.EmployeeId != Actor || existing.TenantId != tenant.GetRequiredTenant().TenantId) return NotFound();
                var last = await db.Set<ContractEditorRevision>().AsNoTracking().SingleAsync(x => x.DocumentId == existing.Id && x.Revision == existing.Revision, ct);
                var previousBindings = JsonSerializer.Deserialize<Dictionary<string, string>>(last.Bindings)!;
                if (existing.IsArchived || existing.IsTemplate != request.IsTemplate || (existing.IsTemplate && existing.IsSharedTemplate != request.IsSharedTemplate) || last.Title != request.Title.Trim() || last.Content != request.Content || previousBindings.Count != request.Bindings.Count || previousBindings.Any(x => !request.Bindings.TryGetValue(x.Key, out var value) || value != x.Value))
                    return Conflict(ApiResponse<object>.Fail("Tài liệu đã được tạo. Mở lại từ danh sách để tránh tạo trùng sau lỗi kết nối."));
                return Ok(ApiResponse<object>.Ok(new { existing.Id, existing.Revision, existing.IsTemplate, existing.IsSharedTemplate, existing.UpdatedAtUtc }));
            }
        }
        string? forkedContent = null;
        if (doc is null && request.IsTemplate && parsed.Preservation is not null)
        {
            var originalLayout = parsed.Layout;
            var editor = new ContractDocumentEditorController(pdf!, db, tenant) { ControllerContext = ControllerContext };
            var exported = await editor.Export("docx", new() { Content = request.Content, Title = request.Title, Bindings = new(), AllowUnboundPreview = true }, ct);
            if (exported is not FileContentResult file) return exported;
            using var stream = new MemoryStream(ContractDocumentEditorController.CleanReusableTemplate(file.FileContents));
            var imported = await editor.Import(new FormFile(stream, 0, stream.Length, "file", "template.docx"), ct);
            if (imported is not OkObjectResult { Value: ApiResponse<object> response }) return imported;
            request.Content = JsonSerializer.SerializeToElement(response.Data, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase }).GetProperty("content").GetString()!;
            forkedContent = request.Content;
            ContractTermRichText.TryParse(request.Content, out parsed);
            parsed.Layout = originalLayout;
            request.Content = ContractTermRichText.Prefix + JsonSerializer.Serialize(parsed, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
            forkedContent = request.Content;
        }
        if (doc is null)
        {
            if (request.ExpectedRevision != 0) return Conflict(ApiResponse<object>.Fail("Phiên bản tạo mới không hợp lệ."));
            doc = new() { Id = request.ClientDocumentId is { } supplied && supplied != Guid.Empty ? supplied : Guid.NewGuid(), TenantId = tenant.GetRequiredTenant().TenantId, EmployeeId = Actor, IsTemplate = request.IsTemplate, IsSharedTemplate = request.IsSharedTemplate };
            db.Add(doc);
        }
        else if (doc.Revision != request.ExpectedRevision) return Conflict(ApiResponse<object>.Fail("Tài liệu đã thay đổi ở cửa sổ khác. Mở lại bản mới nhất trước khi lưu."));
        doc.SourceAssetId = parsed.Preservation?.SourceId;
        doc.Title = request.Title.Trim(); doc.Revision++; doc.UpdatedAtUtc = DateTime.UtcNow;
        db.Add(new ContractEditorRevision { DocumentId = doc.Id, Revision = doc.Revision, Title = doc.Title, Content = request.Content, Bindings = JsonSerializer.Serialize(request.Bindings), CreatedAtUtc = doc.UpdatedAtUtc });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Conflict(ApiResponse<object>.Fail("Tài liệu đã thay đổi ở cửa sổ khác. Hãy mở lại trước khi lưu.")); }
        return Ok(ApiResponse<object>.Ok(new { doc.Id, doc.Revision, doc.IsTemplate, doc.IsSharedTemplate, doc.UpdatedAtUtc, content = forkedContent }));
    }

    [HttpPost("{id:guid}/archive")]
    public async Task<IActionResult> Archive(Guid id, [FromBody] int expectedRevision, CancellationToken ct)
    {
        var doc = await Readable.SingleOrDefaultAsync(x => x.Id == id && x.IsTemplate, ct);
        if (doc is null) return NotFound();
        if (doc.IsSharedTemplate && !await CanManageTemplates(ct)) return StatusCode(403, ApiResponse<object>.Fail("Bạn không có quyền quản lý mẫu dùng chung."));
        if (doc.Revision != expectedRevision) return Conflict(ApiResponse<object>.Fail("Mẫu đã thay đổi. Tải lại trước khi ngừng sử dụng."));
        var current = await db.Set<ContractEditorRevision>().AsNoTracking().SingleAsync(x => x.DocumentId == id && x.Revision == doc.Revision, ct);
        doc.IsArchived = true;
        doc.Revision++; doc.UpdatedAtUtc = DateTime.UtcNow;
        db.Add(new ContractEditorRevision { DocumentId = id, Revision = doc.Revision, Title = current.Title, Content = current.Content, Bindings = current.Bindings, CreatedAtUtc = doc.UpdatedAtUtc });
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException) { return Conflict(ApiResponse<object>.Fail("Mẫu đã thay đổi. Hãy tải lại.")); }
        return Ok(ApiResponse<object>.Ok(new { doc.Id }));
    }
}
