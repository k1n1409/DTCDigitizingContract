using System.Text.Json;
using ContractManagement.API.Common.Responses;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed class ContractEditorDraftsTests
{
    private static DbDtctechContext Context() => new(new DbContextOptionsBuilder<DbDtctechContext>().UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
    private static ContractEditorDraftsController Controller(DbDtctechContext db, int actor = 10, int tenantId = 1)
    {
        var tenant = new CurrentTenant(); tenant.Set(new ResolvedTenant(tenantId, "test", "Test", TenantDatabaseMode.Dedicated, "unused"));
        var http = new DefaultHttpContext { Session = new TestSession() }; http.Session.SetInt32("EmployeeId", actor);
        return new(db, tenant) { ControllerContext = new ControllerContext { HttpContext = http } };
    }

    [Fact]
    public async Task Revisions_AreAppendOnly_AndOldHeadCannotOverwrite()
    {
        await using var db = Context(); var controller = Controller(db);
        var created = Assert.IsType<OkObjectResult>(await controller.Create(new() { Title = "Một" }, default));
        var id = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(created.Value).Data).GetProperty("Id").GetGuid();
        Assert.IsType<OkObjectResult>(await controller.Update(id, new() { Title = "Hai", ExpectedRevision = 1, Bindings = new() { ["CUSTOMER_NAME"] = "Khách A" } }, default));
        Assert.IsType<ConflictObjectResult>(await controller.Update(id, new() { Title = "Ghi đè", ExpectedRevision = 1 }, default));
        Assert.Equal(2, await db.Set<ContractEditorRevision>().CountAsync());
        var old = await db.Set<ContractEditorRevision>().SingleAsync(x => x.Revision == 1);
        Assert.Equal("Một", old.Title);
        Assert.IsType<OkObjectResult>(await controller.Update(id, new() { Title = old.Title, Content = old.Content, ExpectedRevision = 2 }, default));
        Assert.Equal(3, await db.Set<ContractEditorRevision>().CountAsync());
    }

    [Fact]
    public async Task OtherActorOrTenant_CannotReadUpdateOrReadHistory()
    {
        await using var db = Context();
        await Controller(db).Create(new() { Title = "Riêng" }, default);
        var id = (await db.Set<ContractEditorDocument>().SingleAsync()).Id;
        foreach (var outsider in new[] { Controller(db, 20), Controller(db, 10, 2) })
        {
            Assert.IsType<NotFoundResult>(await outsider.Read(id, null, default));
            Assert.IsType<NotFoundResult>(await outsider.History(id, 1, default));
            Assert.IsType<NotFoundResult>(await outsider.Update(id, new() { Title = "Bad", ExpectedRevision = 1 }, default));
            var list = Assert.IsType<OkObjectResult>(await outsider.List(1, null, default));
            var payload = JsonSerializer.SerializeToElement(Assert.IsType<ApiResponse<object>>(list.Value).Data);
            Assert.Empty(payload.GetProperty("items").EnumerateArray());
        }
    }

    [Fact]
    public async Task Sources_ReturnOnlyRequestedPublicFields_AndRejectInactiveRecords()
    {
        await using var db = Context();
        db.TblCustomers.Add(new TblCustomer { CustomerId = 1, CustomerFullName = "Khách hàng", CustomerTaxCode = "123", CustomerPassword = "secret", Status = 1 });
        db.TblCustomers.Add(new TblCustomer { CustomerId = 2, CustomerFullName = "Ngừng", Status = 0 });
        await db.SaveChangesAsync();
        var controller = Controller(db);
        var result = Assert.IsType<OkObjectResult>(await controller.BindingValues("customer", 1, default));
        var fields = Assert.IsType<Dictionary<string, string>>(Assert.IsType<ApiResponse<object>>(result.Value).Data);
        Assert.Equal("123", fields["CUSTOMER_TAX_CODE"]);
        Assert.DoesNotContain("secret", fields.Values);
        Assert.IsType<NotFoundResult>(await controller.BindingValues("customer", 2, default));
        Assert.IsType<BadRequestObjectResult>(await controller.BindingValues("unknown", 1, default));
    }

    [Fact]
    public async Task RetriedCreate_DoesNotDuplicateDocumentOrHistory()
    {
        await using var db = Context(); var controller = Controller(db);
        var request = new ContractEditorDraftsController.SaveRequest { Title = "Retry", ClientDocumentId = Guid.NewGuid(), Bindings = new() { ["CUSTOMER_NAME"] = "A" } };
        Assert.IsType<OkObjectResult>(await controller.Create(request, default));
        Assert.IsType<OkObjectResult>(await controller.Create(request, default));
        Assert.Single(await db.Set<ContractEditorDocument>().ToListAsync());
        Assert.Single(await db.Set<ContractEditorRevision>().ToListAsync());
        request.Title = "Khác";
        Assert.IsType<ConflictObjectResult>(await controller.Create(request, default));
    }

    [Fact]
    public async Task Templates_AreSharedOnlyInTenant_AndOnlyTemplateManagersCanMutate()
    {
        await using var db = Context();
        db.TblEmployees.AddRange(new TblEmployee { EmployeeId = 10, EmployeeType = 6, Status = 1 }, new TblEmployee { EmployeeId = 20, EmployeeType = 1, Status = 1 }, new TblEmployee { EmployeeId = 30, EmployeeType = 3, Status = 1 });
        await db.SaveChangesAsync();
        var owner = Controller(db);
        Assert.IsType<OkObjectResult>(await owner.Create(new() { Title = "Mẫu dùng chung", IsTemplate = true }, default));
        var template = await db.Set<ContractEditorDocument>().SingleAsync();
        var reader = Controller(db, 20);
        Assert.IsType<OkObjectResult>(await reader.Read(template.Id, null, default));
        Assert.IsType<OkObjectResult>(await reader.History(template.Id, 1, default));
        Assert.IsType<NotFoundResult>(await Controller(db, 20, 2).Read(template.Id, null, default));
        Assert.Equal(403, Assert.IsType<ObjectResult>(await reader.Update(template.Id, new() { Title = "Không được sửa", IsTemplate = true, ExpectedRevision = 1 }, default)).StatusCode);
        Assert.Equal(403, Assert.IsType<ObjectResult>(await reader.Create(new() { Title = "Không được tạo", IsTemplate = true }, default)).StatusCode);
        Assert.Equal(403, Assert.IsType<ObjectResult>(await reader.Archive(template.Id, 1, default)).StatusCode);
        var admin = Controller(db, 30);
        Assert.IsType<OkObjectResult>(await admin.Update(template.Id, new() { Title = "Mẫu đã sửa", IsTemplate = true, ExpectedRevision = 1 }, default));
        Assert.IsType<ConflictObjectResult>(await admin.Archive(template.Id, 1, default));
        Assert.IsType<OkObjectResult>(await reader.Create(new() { Title = "Bản riêng" }, default));
        Assert.IsType<OkObjectResult>(await admin.Archive(template.Id, 2, default));
        Assert.IsType<NotFoundResult>(await reader.Read(template.Id, null, default));
        Assert.Equal(3, await db.Set<ContractEditorRevision>().CountAsync(x => x.DocumentId == template.Id));
        Assert.True(await db.Set<ContractEditorDocument>().AnyAsync(x => x.Title == "Bản riêng" && !x.IsArchived));
    }

    private sealed class TestSession : ISession
    {
        private readonly Dictionary<string, byte[]> values = [];
        public bool IsAvailable => true;
        public string Id => "test";
        public IEnumerable<string> Keys => values.Keys;
        public void Clear() => values.Clear();
        public Task CommitAsync(CancellationToken ct = default) => Task.CompletedTask;
        public Task LoadAsync(CancellationToken ct = default) => Task.CompletedTask;
        public void Remove(string key) => values.Remove(key);
        public void Set(string key, byte[] value) => values[key] = value;
        public bool TryGetValue(string key, out byte[] value) => values.TryGetValue(key, out value!);
    }
}
