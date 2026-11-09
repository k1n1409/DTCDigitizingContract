namespace ContractManagement.API.Common.Enums;

/// <summary>Administrative result, independent of legal approval/signing status.</summary>
public enum ContractOutcome : byte { InProgress = 0, Succeeded = 1, Failed = 2, StoppedRenewal = 3 }
