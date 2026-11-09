using ContractManagement.API.Common.Enums;
using ContractManagement.API.Domains.DTOs.Responses.Contract;
using Microsoft.EntityFrameworkCore;

namespace ContractManagement.Domains.Services.Contract;
public partial class ContractService
{
    public async Task<ContractFilterOptionsResponse> GetFilterOptionsAsync(int employeeId, bool canReadTenant = false, bool canReadExecution = false)
    {
        if (employeeId <= 0) throw new UnauthorizedAccessException();
        var scope = _dbContext.TblContracts.AsNoTracking().Where(c => canReadTenant || c.EmployeeId == employeeId
            || canReadExecution && (c.Status == 3 || c.Status == 4 || c.Status == 5));
        var customers = await _dbContext.TblCustomers.AsNoTracking().Where(x => scope.Any(c => c.CustomerId == x.CustomerId))
            .OrderBy(x => x.CustomerCompany ?? x.CustomerFullName).Select(x => new ContractFilterOption(x.CustomerId, x.CustomerCompany ?? x.CustomerFullName ?? x.CustomerCode ?? "Khách hàng")).ToListAsync();
        var employees = await _dbContext.TblEmployees.AsNoTracking().Where(x => scope.Any(c => c.EmployeeId == x.EmployeeId))
            .OrderBy(x => x.EmployeeFullName).Select(x => new ContractFilterOption(x.EmployeeId, x.EmployeeFullName ?? x.EmployeeCode ?? "Nhân viên")).ToListAsync();
        var departments = await _dbContext.TblDepartments.AsNoTracking().Where(d => _dbContext.TblEmployees.Any(e => e.DepartmentId == d.DepartmentId && scope.Any(c => c.EmployeeId == e.EmployeeId)))
            .OrderBy(x => x.DepartmentName).Select(x => new ContractFilterOption(x.DepartmentId, x.DepartmentName)).ToListAsync();
        return new(customers, employees, departments, await scope.Where(x => x.CurrencyCode != null && x.CurrencyCode.Length == 3).Select(x => x.CurrencyCode).Distinct().OrderBy(x => x).ToListAsync());
    }
    private sealed class PaymentFilterRow { public int VersionId { get; set; } public decimal Total { get; set; } public decimal Paid { get; set; } }
    private IQueryable<PaymentFilterRow> PaymentFilterRows()
    {
        var valid = from p in _dbContext.TblContractPaymentLedgers
            join candidate in _dbContext.TblFileStorages on p.EvidenceFileId equals (int?)candidate.FileId into files
            from file in files.DefaultIfEmpty()
            where p.Status == (byte)ContractPaymentStatus.Active && (!p.EvidenceFileId.HasValue || file != null && file.ObjectType == "ContractPaymentEvidence" && file.ObjectId == p.ContractId)
            select p;
        return _dbContext.TblContractVersions.AsNoTracking().Select(v => new PaymentFilterRow {
            VersionId = v.VersionId, Total = v.TotalAmount,
            Paid = _dbContext.TblContractPaymentMilestones.Any(m => m.ContractId == v.ContractId && m.VersionId == v.VersionId)
                ? _dbContext.TblContractPaymentMilestones.Where(m => m.ContractId == v.ContractId && m.VersionId == v.VersionId && m.PaymentStatus == (byte)ContractPaymentMilestoneStatus.Paid
                    && valid.Count(p => p.ContractId == v.ContractId && p.VersionId == v.VersionId && p.PaymentMilestoneId == m.PaymentMilestoneId) == 1
                    && valid.Any(p => p.ContractId == v.ContractId && p.VersionId == v.VersionId && p.PaymentMilestoneId == m.PaymentMilestoneId && p.Amount == m.Amount && p.CurrencyCode == v.CurrencyCode))
                    .Sum(m => (decimal?)m.Amount) ?? 0m
                : _dbContext.TblContractPaymentLedgers.Where(p => p.ContractId == v.ContractId && p.VersionId == v.VersionId && p.Status == (byte)ContractPaymentStatus.Active).Sum(p => (decimal?)p.Amount) ?? 0m
        });
    }
}
