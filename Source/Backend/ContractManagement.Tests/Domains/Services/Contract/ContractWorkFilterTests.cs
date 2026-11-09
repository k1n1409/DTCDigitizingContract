using ContractManagement.API.Common.Enums;
using ContractManagement.API.Domains.Controllers.Contract;
using ContractManagement.Domains.Services.Contract;
using ContractManagement.Infrastructure.MultiTenancy.Enums;
using ContractManagement.Infrastructure.MultiTenancy.Models;
using ContractManagement.Infrastructure.MultiTenancy.Services;
using ContractManagement.Infrastructure.Persistence.Application;
using ContractManagement.Infrastructure.Persistence.Application.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.Tests.Domains.Services.Contract;

public sealed partial class ContractCompletionServicePhase10Tests
{
    [Fact]
    public async Task WorkFilters_CombineOwnerDatesAmountsAndPayment()
    {
        await using var db = CreateContext();
        await SeedAsync(db, ContractStatus.Signed, activePayments: [100m]);
        var date = DateTime.UtcNow.AddHours(7).Date.AddDays(10);
        var contract = await db.TblContracts.SingleAsync();
        contract.ExpireDate = date.AddHours(18);
        await db.SaveChangesAsync();
        var service = new ContractService(db, null!);
        var filter = new ContractManagement.API.Domains.DTOs.Requests.Contract.ContractFilterRequest {
            CustomerId = CustomerId, OnlyMine = true, ExpireFrom = date, ExpireTo = date,
            MinAmount = ContractTotal, MaxAmount = ContractTotal, CurrencyCode = "vnd",
            PaymentState = ContractPaymentFilterState.Partial
        };
        Assert.Single((await service.GetListAsync(filter, OwnerId)).Items);
        Assert.Empty((await service.GetListAsync(filter, ManagerId, canReadTenant: true)).Items);
        Assert.Empty((await service.GetFilterOptionsAsync(OtherEmployeeId)).Customers);
        Assert.Single((await service.GetFilterOptionsAsync(OwnerId)).Customers);
        filter.PaymentState = ContractPaymentFilterState.Paid;
        Assert.Empty((await service.GetListAsync(filter, OwnerId)).Items);
        filter.ExpiringInDays = 30;
        await Assert.ThrowsAsync<ArgumentException>(() => service.GetListAsync(filter, OwnerId));
    }

    [Fact]
    public async Task WorkFilters_PresetsAreIsolatedByEmployeeAndTenant()
    {
        await using var db = CreateContext();
        SavedContractFiltersController Api(int tenantId, int employeeId)
        {
            var tenant = new CurrentTenant();
            tenant.Set(new ResolvedTenant(tenantId, "TEST", "Test", TenantDatabaseMode.Dedicated, "unused"));
            var http = new DefaultHttpContext { Session = new CorrectionSession() };
            http.Session.SetInt32("EmployeeId", employeeId);
            return new(db, tenant) { ControllerContext = new ControllerContext { HttpContext = http } };
        }
        var owner = Api(TenantId, OwnerId);
        Assert.IsType<OkObjectResult>(await owner.Save(new() {
            Name = "Sắp hết hạn", Filter = new() { OnlyMine = true, ExpiringInDays = 30, MinAmount = 99999999999999.9999m }
        }, default));
        var saved = await db.Set<SavedContractFilter>().SingleAsync();
        Assert.Contains("\"99999999999999.9999\"", saved.FilterJson);
        Assert.IsType<NotFoundResult>(await Api(TenantId, OtherEmployeeId).Delete(saved.Id, default));
        Assert.IsType<NotFoundResult>(await Api(TenantId + 1, OwnerId).Delete(saved.Id, default));
        Assert.IsType<OkObjectResult>(await owner.Delete(saved.Id, default));
        Assert.Empty(db.Set<SavedContractFilter>());
    }

    [Fact]
    public void WorkFilters_PaymentProjectionTranslatesToSqlServer()
    {
        using var db = new DbDtctechContext(new DbContextOptionsBuilder<DbDtctechContext>()
            .UseSqlServer("Server=localhost;Database=unused;Integrated Security=True").Options);
        var method = typeof(ContractService).GetMethod("PaymentFilterRows", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance)!;
        var query = (IQueryable)method.Invoke(new ContractService(db, null!), null)!;
        Assert.Contains("SUM(", query.ToQueryString());
    }
}
