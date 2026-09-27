namespace Fylkren.Api;

internal static class SafeImageUpload
{
    internal const long MaximumBytes = 2 * 1024 * 1024;

    internal static async Task<Result?> ReadAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0 || file.Length > MaximumBytes) return null;

        await using var input = file.OpenReadStream();
        using var memory = new MemoryStream((int)file.Length);
        await input.CopyToAsync(memory, cancellationToken);
        var bytes = memory.ToArray();
        var detectedContentType = DetectContentType(bytes);

        if (detectedContentType is null ||
            !string.Equals(file.ContentType, detectedContentType, StringComparison.OrdinalIgnoreCase))
            return null;

        return new Result(bytes, detectedContentType);
    }

    private static string? DetectContentType(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length >= 8 && bytes[..8].SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }))
            return "image/png";
        if (bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff)
            return "image/jpeg";
        if (bytes.Length >= 12 && bytes[..4].SequenceEqual("RIFF"u8) && bytes.Slice(8, 4).SequenceEqual("WEBP"u8))
            return "image/webp";
        return null;
    }

    internal sealed record Result(byte[] Bytes, string ContentType);
}
