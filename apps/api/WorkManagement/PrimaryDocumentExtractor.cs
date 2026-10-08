using System.IO.Compression;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Xml.Linq;
using UglyToad.PdfPig;

namespace Fylkren.Api.WorkManagement;

internal static class PrimaryDocumentExtractor
{
    internal const long MaximumBytes = 8 * 1024 * 1024;
    internal const int MaximumCharacters = 100_000;
    private const long MaximumDocxExpandedBytes = 24 * 1024 * 1024;
    private const int MaximumDocxEntries = 256;
    private const int MaximumPdfPages = 250;
    private static readonly UTF8Encoding StrictUtf8 = new(false, true);

    internal sealed record Result(string Name, string MediaType, string Sha256, string Text, string StructuredContent, int BlockCount);
    private sealed record Block(int Order, string Kind, string? Heading, int? Page, string Text);

    internal static async Task<Result> Extract(IFormFile file, CancellationToken ct)
    {
        if (file.Length is <= 0 or > MaximumBytes) throw new InvalidDataException("size");
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var mediaType = file.ContentType.Split(';', 2)[0].Trim().ToLowerInvariant();
        if (!Allowed(extension, mediaType)) throw new InvalidDataException("type");
        await using var input = file.OpenReadStream();
        using var buffer = new MemoryStream((int)file.Length);
        await input.CopyToAsync(buffer, ct);
        if (buffer.Length != file.Length || buffer.Length > MaximumBytes) throw new InvalidDataException("size");
        var bytes = buffer.ToArray();
        var blocks = extension switch
        {
            ".txt" => TextBlocks(bytes),
            ".docx" => DocxBlocks(bytes),
            ".pdf" => PdfBlocks(bytes),
            _ => throw new InvalidDataException("type")
        };
        if (blocks.Count == 0) throw new InvalidDataException("empty");
        var text = string.Join("\n\n", blocks.Select(value => value.Heading is null ? value.Text : $"{value.Heading}\n{value.Text}")).Trim();
        if (text.Length is < 2 or > MaximumCharacters) throw new InvalidDataException("text-size");
        var name = SafeName(file.FileName, extension);
        return new Result(name, CanonicalMediaType(extension), Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(), text,
            JsonSerializer.Serialize(new { schemaVersion = 1, blocks }, new JsonSerializerOptions(JsonSerializerDefaults.Web)), blocks.Count);
    }

    private static List<Block> TextBlocks(byte[] bytes)
    {
        var text = Normalize(StrictUtf8.GetString(bytes));
        return ParagraphBlocks(text, null);
    }

    private static List<Block> DocxBlocks(byte[] bytes)
    {
        using var archive = new ZipArchive(new MemoryStream(bytes, false), ZipArchiveMode.Read, false);
        if (archive.Entries.Count > MaximumDocxEntries || archive.Entries.Sum(entry => entry.Length) > MaximumDocxExpandedBytes ||
            archive.Entries.Any(entry => entry.FullName.Contains("vbaProject", StringComparison.OrdinalIgnoreCase) || UnsafePath(entry.FullName)))
            throw new InvalidDataException("active-or-expanded");
        var document = archive.GetEntry("word/document.xml") ?? throw new InvalidDataException("docx");
        if (document.Length > MaximumDocxExpandedBytes) throw new InvalidDataException("active-or-expanded");
        using var stream = document.Open();
        var xml = XDocument.Load(stream, LoadOptions.None);
        XNamespace w = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
        var blocks = new List<Block>();
        foreach (var paragraph in xml.Descendants(w + "p"))
        {
            var text = Normalize(string.Concat(paragraph.Descendants(w + "t").Select(node => node.Value)));
            if (string.IsNullOrWhiteSpace(text)) continue;
            var style = paragraph.Descendants(w + "pStyle").Select(node => (string?)node.Attribute(w + "val")).FirstOrDefault();
            var heading = style?.StartsWith("Heading", StringComparison.OrdinalIgnoreCase) == true ? text : null;
            blocks.Add(new Block(blocks.Count + 1, heading is null ? "paragraph" : "heading", heading, null, heading is null ? text : ""));
        }
        return Bound(blocks);
    }

    private static List<Block> PdfBlocks(byte[] bytes)
    {
        using var document = PdfDocument.Open(bytes);
        if (document.NumberOfPages > MaximumPdfPages) throw new InvalidDataException("pages");
        var blocks = new List<Block>();
        foreach (var page in document.GetPages())
        {
            var text = Normalize(page.Text);
            if (!string.IsNullOrWhiteSpace(text)) blocks.Add(new Block(blocks.Count + 1, "page", null, page.Number, text));
        }
        return Bound(blocks);
    }

    private static List<Block> ParagraphBlocks(string text, int? page) => Bound(text.Split("\n\n", StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select((value, index) => new Block(index + 1, "paragraph", null, page, value)).ToList());
    private static List<Block> Bound(List<Block> blocks)
    {
        var total = 0; var result = new List<Block>();
        foreach (var block in blocks)
        {
            if (block.Text.Length > 20_000 || block.Heading?.Length > 500) throw new InvalidDataException("block-size");
            total += block.Text.Length + (block.Heading?.Length ?? 0);
            if (total > MaximumCharacters) throw new InvalidDataException("text-size");
            result.Add(block with { Order = result.Count + 1 });
        }
        return result;
    }
    private static bool Allowed(string extension, string mediaType) => (extension, mediaType) switch
    {
        (".txt", "text/plain") => true,
        (".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document") => true,
        (".pdf", "application/pdf") => true,
        _ => false
    };
    private static string CanonicalMediaType(string extension) => extension switch { ".txt" => "text/plain", ".docx" => "application/vnd.openxmlformats-officedocument.wordprocessingml.document", _ => "application/pdf" };
    private static string Normalize(string value) => string.Join('\n', value.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n').Select(line => string.Join(' ', line.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)))).Trim();
    private static bool UnsafePath(string path) => path.StartsWith('/') || path.Contains("..", StringComparison.Ordinal) || path.Contains('\\');
    private static string SafeName(string value, string extension)
    {
        var name = new string(Path.GetFileNameWithoutExtension(value).Where(character => !char.IsControl(character)).ToArray()).Trim();
        if (name.Length > 180) name = name[..180];
        return (string.IsNullOrWhiteSpace(name) ? "primary-document" : name) + extension;
    }
}
