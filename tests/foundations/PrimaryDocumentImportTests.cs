using System.IO.Compression;
using System.Text;
using Fylkren.Api.WorkManagement;
using Microsoft.AspNetCore.Http;
using UglyToad.PdfPig.Content;
using UglyToad.PdfPig.Core;
using UglyToad.PdfPig.Fonts.Standard14Fonts;
using UglyToad.PdfPig.Writer;

internal static class PrimaryDocumentImportTests
{
    internal static async Task Run()
    {
        var text = await PrimaryDocumentExtractor.Extract(File("basis.txt", "text/plain", Encoding.UTF8.GetBytes("Purpose\n\n- Establish reserve communication\n- Test before approval")), default);
        Require(text.Text.Contains("reserve communication") && text.BlockCount == 2 && text.Sha256.Length == 64, "Plain-text extraction lost bounded structure or digest provenance.");

        var docx = await PrimaryDocumentExtractor.Extract(File("basis.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Docx(false)), default);
        Require(docx.Text.Contains("Operational purpose") && docx.StructuredContent.Contains("heading"), "DOCX headings were not retained as structured content.");

        var pdf = await PrimaryDocumentExtractor.Extract(File("basis.pdf", "application/pdf", Pdf()), default);
        Require(pdf.Text.Contains("Reserve communication") && pdf.StructuredContent.Contains("\"page\":1"), "PDF text or page provenance was not retained.");

        await Reject(File("wrong.pdf", "text/plain", Encoding.UTF8.GetBytes("not a pdf")));
        await Reject(File("active.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", Docx(true)));
        await Reject(File("oversized.txt", "text/plain", new byte[PrimaryDocumentExtractor.MaximumBytes + 1]));
        Console.WriteLine("Primary document import tests passed: strict type agreement, bounded text/DOCX/PDF extraction, digest/page provenance and active-content/size rejection.");
    }

    private static FormFile File(string name, string contentType, byte[] bytes) => new(new MemoryStream(bytes), 0, bytes.Length, "document", name) { Headers = new HeaderDictionary(), ContentType = contentType };
    private static byte[] Docx(bool active)
    {
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            var entry = zip.CreateEntry("word/document.xml");
            using (var writer = new StreamWriter(entry.Open(), Encoding.UTF8, leaveOpen: false)) writer.Write("<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\"><w:body><w:p><w:pPr><w:pStyle w:val=\"Heading1\"/></w:pPr><w:r><w:t>Operational purpose</w:t></w:r></w:p><w:p><w:r><w:t>Establish a tested reserve channel.</w:t></w:r></w:p></w:body></w:document>");
            if (active) { var macro = zip.CreateEntry("word/vbaProject.bin"); using var stream = macro.Open(); stream.WriteByte(1); }
        }
        return output.ToArray();
    }
    private static byte[] Pdf()
    {
        var builder = new PdfDocumentBuilder();
        var font = builder.AddStandard14Font(Standard14Font.Helvetica);
        var page = builder.AddPage(PageSize.A4);
        page.AddText("Reserve communication plan", 12, new PdfPoint(50, 750), font);
        return builder.Build();
    }
    private static async Task Reject(FormFile file)
    {
        try { _ = await PrimaryDocumentExtractor.Extract(file, default); }
        catch (InvalidDataException) { return; }
        throw new Exception("Unsafe primary document was accepted.");
    }
    private static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
}
