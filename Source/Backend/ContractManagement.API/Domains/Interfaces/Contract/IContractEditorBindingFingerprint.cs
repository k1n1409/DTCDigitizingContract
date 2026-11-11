namespace ContractManagement.Domains.Interfaces.Contract;

/// <summary>Captures the persisted business version without rendering a template file.</summary>
public interface IContractEditorBindingFingerprint
{
    Task<ContractEditorBindingCapture> CaptureEditorBindingAsync(int contractId, int employeeId, CancellationToken ct = default);
}

public sealed record ContractEditorBindingCapture(int VersionId, string BusinessHash, string ReviewSnapshot);
