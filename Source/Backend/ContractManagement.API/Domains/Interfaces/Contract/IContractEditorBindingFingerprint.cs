namespace ContractManagement.Domains.Interfaces.Contract;

/// <summary>Captures the persisted business version without rendering a template file.</summary>
public interface IContractEditorBindingFingerprint
{
    Task<string> CaptureEditorBindingHashAsync(int contractId, int employeeId, CancellationToken ct = default);
}
