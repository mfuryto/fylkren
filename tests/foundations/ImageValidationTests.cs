using System.Text;
using Fylkren.Api;
using SkiaSharp;

internal static class ImageValidationTests
{
    internal static void Run()
    {
        var formats = new[]
        {
            (SKEncodedImageFormat.Png, "image/png", "image.png"),
            (SKEncodedImageFormat.Jpeg, "image/jpeg", "image.jpg"),
            (SKEncodedImageFormat.Webp, "image/webp", "image.webp")
        };
        foreach (var (format, mediaType, fileName) in formats)
        {
            var input = Encode(format, 2, 2);
            var result = SafeImageUpload.Sanitize(input, mediaType, fileName) ?? throw new Exception($"Valid {mediaType} was rejected.");
            Require(result.ContentType == mediaType, $"Valid {mediaType} changed type.");
            using var data = SKData.CreateCopy(result.Bytes);
            using var codec = SKCodec.Create(data);
            Require(codec?.EncodedFormat == format, $"Sanitized {mediaType} changed type.");
        }

        var png = Encode(SKEncodedImageFormat.Png, 2, 2);
        Require(SafeImageUpload.Sanitize(png, "image/png", "image.jpg") is null, "Mismatched extension was accepted.");
        Require(SafeImageUpload.Sanitize(png, "image/jpeg", "image.png") is null, "Mismatched declared media type was accepted.");
        Require(SafeImageUpload.Sanitize(png[..12], "image/png", "image.png") is null, "Truncated image was accepted.");
        Require(SafeImageUpload.Sanitize(Encoding.UTF8.GetBytes("<script>synthetic()</script>"), "image/png", "image.png") is null,
            "Active text was accepted as an image.");

        var marker = Encoding.UTF8.GetBytes("<script>synthetic-trailing-content()</script>");
        var padded = new byte[SafeImageUpload.MaximumBytes];
        png.CopyTo(padded, 0); marker.CopyTo(padded, padded.Length - marker.Length);
        var sanitized = SafeImageUpload.Sanitize(padded, "image/png", "boundary.png");
        Require(sanitized is not null && sanitized.Bytes.AsSpan().IndexOf(marker) < 0, "Trailing content survived image re-encoding.");
        var oversized = new byte[padded.Length + 1]; padded.CopyTo(oversized, 0);
        Require(SafeImageUpload.Sanitize(oversized, "image/png", "oversized.png") is null, "One byte above the image limit was accepted.");

        var excessiveDimensions = Encode(SKEncodedImageFormat.Png, SafeImageUpload.MaximumDimension + 1, 1);
        Require(SafeImageUpload.Sanitize(excessiveDimensions, "image/png", "wide.png") is null, "Excessive image dimensions were accepted.");
        Console.WriteLine("Image validation passed: PNG/JPEG/WebP decode and re-encode, extension/type match, exact byte boundary, trailing-content removal, truncation and dimension bounds.");
    }

    private static byte[] Encode(SKEncodedImageFormat format, int width, int height)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(SKColors.CornflowerBlue);
        using var encoded = bitmap.Encode(format, 90) ?? throw new Exception($"Cannot create {format} fixture.");
        return encoded.ToArray();
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
}
