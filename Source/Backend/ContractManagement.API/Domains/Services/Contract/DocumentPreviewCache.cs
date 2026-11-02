using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Memory;

namespace ContractManagement.Domains.Services.Contract;

/// <summary>Short-lived RAM cache, never bypassing the caller's authorization checks.</summary>
internal static class DocumentPreviewCache
{
    private sealed record Preview(byte[] Bytes, string? Name);
    private static readonly MemoryCache Cache = new(new MemoryCacheOptions { SizeLimit = 64 * 1024 * 1024 });
    // Bounded lock set: no per-document semaphore leak and no duplicate conversion on a cache miss.
    private static readonly SemaphoreSlim[] Gates = Enumerable.Range(0, 64).Select(_ => new SemaphoreSlim(1, 1)).ToArray();

    public static async Task<IActionResult> GetAsync(string key, Func<Task<IActionResult>> create, CancellationToken ct)
    {
        FileContentResult Result(Preview value) => new(value.Bytes.ToArray(), "application/pdf") { FileDownloadName = value.Name };
        if (Cache.TryGetValue<Preview>(key, out var hit) && hit is not null) return Result(hit);
        var gate = Gates[(int)((uint)StringComparer.Ordinal.GetHashCode(key) % (uint)Gates.Length)];
        await gate.WaitAsync(ct);
        try
        {
            if (Cache.TryGetValue<Preview>(key, out hit) && hit is not null) return Result(hit);
            var result = await create();
            if (result is FileContentResult { ContentType: "application/pdf" } file && file.FileContents.Length <= 25 * 1024 * 1024)
                Cache.Set(key, new Preview(file.FileContents.ToArray(), file.FileDownloadName), new MemoryCacheEntryOptions { Size = file.FileContents.Length, AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) });
            return result;
        }
        finally { gate.Release(); }
    }
}
