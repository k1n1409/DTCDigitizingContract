namespace ContractManagement.Infrastructure.Persistence.Application.Models;
public sealed class SavedContractFilter
{
    public Guid Id { get; set; }
    public int TenantId { get; set; }
    public int EmployeeId { get; set; }
    public string Name { get; set; } = "";
    public string FilterJson { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
