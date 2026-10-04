using SkiaSharp;

namespace Fylkren.Api;

internal static class SafeImageUpload
{
    internal const long MaximumBytes = 2 * 1024 * 1024;
    internal const int MaximumDimension = 4096;
    internal const long MaximumPixels = 16_777_216;

    internal static async Task<Result?> ReadAsync(IFormFile? file, CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0 || file.Length > MaximumBytes) return null;

        await using var input = file.OpenReadStream();
        using var memory = new MemoryStream((int)file.Length);
        await input.CopyToAsync(memory, cancellationToken);
        return Sanitize(memory.ToArray(), file.ContentType, file.FileName);
    }

    internal static Result? Sanitize(byte[] bytes, string? declaredContentType, string? fileName)
    {
        if (bytes.LongLength is 0 or > MaximumBytes) return null;
        var extensionContentType = Path.GetExtension(fileName ?? "").ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => null
        };
        if (extensionContentType is null || !string.Equals(declaredContentType, extensionContentType, StringComparison.OrdinalIgnoreCase))
            return null;

        using var data = SKData.CreateCopy(bytes);
        using var codec = SKCodec.Create(data);
        if (codec is null) return null;
        var detected = codec.EncodedFormat switch
        {
            SKEncodedImageFormat.Png => "image/png",
            SKEncodedImageFormat.Jpeg => "image/jpeg",
            SKEncodedImageFormat.Webp => "image/webp",
            _ => null
        };
        var info = codec.Info;
        if (detected is null || !string.Equals(detected, extensionContentType, StringComparison.Ordinal) ||
            info.Width <= 0 || info.Height <= 0 || info.Width > MaximumDimension || info.Height > MaximumDimension ||
            checked((long)info.Width * info.Height) > MaximumPixels)
            return null;
        using var bitmap = SKBitmap.Decode(bytes);
        if (bitmap is null || bitmap.Width != info.Width || bitmap.Height != info.Height) return null;
        using var sanitized = bitmap.Encode(codec.EncodedFormat, codec.EncodedFormat == SKEncodedImageFormat.Png ? 100 : 90);
        if (sanitized is null || sanitized.Size is 0 || sanitized.Size > MaximumBytes) return null;
        return new Result(sanitized.ToArray(), detected);
    }

    internal sealed record Result(byte[] Bytes, string ContentType);
}
