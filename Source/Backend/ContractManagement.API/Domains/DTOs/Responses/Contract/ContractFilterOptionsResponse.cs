namespace ContractManagement.API.Domains.DTOs.Responses.Contract;
public sealed record ContractFilterOption(int Id, string Name);
public sealed record ContractFilterOptionsResponse(IReadOnlyList<ContractFilterOption> Customers,
    IReadOnlyList<ContractFilterOption> Employees, IReadOnlyList<ContractFilterOption> Departments, IReadOnlyList<string> Currencies);
