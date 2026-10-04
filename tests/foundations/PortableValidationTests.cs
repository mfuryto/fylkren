using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Fylkren.Api.Portability;

internal static class PortableValidationTests
{
    internal static async Task Run(byte[] package, Guid site)
    {
        var files = new Dictionary<string, byte[]>();
        using (var zip = new ZipArchive(new MemoryStream(package), ZipArchiveMode.Read))
            foreach (var entry in zip.Entries) { using var input = entry.Open(); using var buffer = new MemoryStream(); input.CopyTo(buffer); files.Add(entry.FullName, buffer.ToArray()); }
        var json = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        var original = JsonSerializer.Deserialize<PortableExportManifest>(files["manifest.json"], json)!;
        foreach (var edit in new Action<JsonObject>[] {
            row => row["owner_site_id"] = Guid.NewGuid().ToString(),
            row => row["owner_site_id"] = 42,
            row => row["policy_id"] = Guid.NewGuid().ToString(),
            row => row["policy_version"] = "1",
            row => { row["policy_id"] = null; row["policy_version"] = 1; },
        })
        {
            var path = "data/information-lifecycle.jsonl";
            var rows = Encoding.UTF8.GetString(files[path]).Split('\n', StringSplitOptions.RemoveEmptyEntries).Select(s => JsonNode.Parse(s)!.AsObject()).ToArray();
            edit(rows[0]);
            var data = Encoding.UTF8.GetBytes(string.Join('\n', rows.Select(r => r.ToJsonString())) + "\n");
            var changed = new Dictionary<string, byte[]>(files) { [path] = data };
            changed["manifest.json"] = JsonSerializer.SerializeToUtf8Bytes(original with { Datasets = original.Datasets.Select(d => d.Path == path ? d with { Bytes = data.Length, Sha256 = PortableExportPackage.Hash(data) } : d).ToArray() }, json);
            var result = await PortableImportValidator.Validate(new MemoryStream(Zip(changed)), site, default);
            if (result.Valid) throw new Exception("Untrusted lifecycle owner/policy shape accepted.");
        }
        var legacy = new Dictionary<string, byte[]>(files) { ["manifest.json"] = JsonSerializer.SerializeToUtf8Bytes(original with { FormatVersion = "1.0", Snapshot = null }, json) };
        var accepted = await PortableImportValidator.Validate(new MemoryStream(Zip(legacy)), site, default);
        if (!accepted.Valid || !accepted.Warnings.Any(w => w.Contains("Legacy format"))) throw new Exception("Legacy 1.0 compatibility lost.");
        Console.WriteLine("Portable validation passed: foreign/numeric owners, missing/unpaired/string policy versions rejected with correct dataset hashes; legacy 1.0 accepted with explicit evidence limitation.");
    }
    private static byte[] Zip(Dictionary<string, byte[]> files)
    {
        using var buffer = new MemoryStream();
        using (var zip = new ZipArchive(buffer, ZipArchiveMode.Create, true))
            foreach (var file in files) { using var output = zip.CreateEntry(file.Key).Open(); output.Write(file.Value); }
        return buffer.ToArray();
    }
}
