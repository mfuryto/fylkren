using System.IO.Compression;
using Fylkren.Api.Portability;

internal static class ZipLengthBoundaryTests
{
    internal static async Task Run()
    {
        const ulong maximum = 16UL * 1024 * 1024;
        foreach (var (sizes, oversized) in new (ulong[], bool)[] {
            ([long.MaxValue, long.MaxValue], true), ([ulong.MaxValue, 0], true),
            ([maximum / 2, maximum / 2 + 1], true), ([maximum / 2, maximum / 2], false), ([0, 0], false) })
        {
            var bytes = Fixture(sizes);
            if (bytes.Length > 512) throw new Exception("ZIP64 fixture allocated declared data.");
            using (var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read))
            {
                if (zip.Entries.Count != 2) throw new Exception("ZIP64 fixture directory was not read.");
                if (sizes[0] <= long.MaxValue && zip.Entries[0].Length != (long)sizes[0])
                    throw new Exception("ZIP64 declared length was not read.");
            }
            var result = await PortableImportValidator.Validate(new MemoryStream(bytes), Guid.NewGuid(), default);
            if (result.Valid || !result.Errors.Any(e => e.Contains(oversized ? "16 MiB" : "missing manifest")))
                throw new Exception("ZIP64 size boundary returned the wrong validation result.");
        }
        var exactCount = await PortableImportValidator.Validate(new MemoryStream(CountFixture(250)), Guid.NewGuid(), default);
        if (exactCount.Valid || !exactCount.Errors.Any(error => error.Contains("missing manifest")))
            throw new Exception("The exact 250-entry boundary did not proceed to manifest validation.");
        var excessiveCount = await PortableImportValidator.Validate(new MemoryStream(CountFixture(251)), Guid.NewGuid(), default);
        if (excessiveCount.Valid || !excessiveCount.Errors.Any(error => error.Contains("more than 250 files")))
            throw new Exception("A package above the 250-entry boundary was not rejected.");

        var exactCompressed = HighlyCompressed((int)maximum);
        if (exactCompressed.Length >= 64 * 1024) throw new Exception("The compression-ratio fixture is not meaningfully compressed.");
        var exactCompressedResult = await PortableImportValidator.Validate(new MemoryStream(exactCompressed), Guid.NewGuid(), default);
        if (exactCompressedResult.Valid || !exactCompressedResult.Errors.Any(error => error.Contains("invalid JSON")))
            throw new Exception("The exact uncompressed-size boundary did not proceed to bounded content validation.");
        var excessiveCompressedResult = await PortableImportValidator.Validate(
            new MemoryStream(HighlyCompressed((int)maximum + 1)), Guid.NewGuid(), default);
        if (excessiveCompressedResult.Valid || !excessiveCompressedResult.Errors.Any(error => error.Contains("16 MiB")))
            throw new Exception("A highly compressed package above the uncompressed-size boundary was not rejected before content validation.");

        Console.WriteLine("ZIP boundary tests passed: ZIP64 overflow/unsigned/aggregate lengths, 250/251 entries and highly compressed exact/over-limit content are bounded before entry processing.");
    }

    private static byte[] Fixture(ulong[] sizes)
    {
        using var buffer = new MemoryStream();
        using var writer = new BinaryWriter(buffer, System.Text.Encoding.UTF8, true);
        var offsets = new uint[sizes.Length];
        for (var i = 0; i < sizes.Length; i++)
        {
            offsets[i] = (uint)buffer.Position;
            writer.Write(0x04034b50U); writer.Write((ushort)45); writer.Write((ushort)0);
            writer.Write((ushort)0); writer.Write(0U); writer.Write(0U); writer.Write(0U);
            writer.Write(uint.MaxValue); writer.Write((ushort)1); writer.Write((ushort)12);
            writer.Write((byte)('a' + i)); Extra(writer, sizes[i]);
        }
        var directory = (uint)buffer.Position;
        for (var i = 0; i < sizes.Length; i++)
        {
            writer.Write(0x02014b50U); writer.Write((ushort)45); writer.Write((ushort)45);
            writer.Write((ushort)0); writer.Write((ushort)0); writer.Write(0U); writer.Write(0U);
            writer.Write(0U); writer.Write(uint.MaxValue); writer.Write((ushort)1); writer.Write((ushort)12);
            writer.Write((ushort)0); writer.Write((ushort)0); writer.Write((ushort)0); writer.Write(0U);
            writer.Write(offsets[i]); writer.Write((byte)('a' + i)); Extra(writer, sizes[i]);
        }
        var length = (uint)buffer.Position - directory;
        writer.Write(0x06054b50U); writer.Write(0U); writer.Write((ushort)sizes.Length);
        writer.Write((ushort)sizes.Length); writer.Write(length); writer.Write(directory); writer.Write((ushort)0);
        return buffer.ToArray();
    }
    private static void Extra(BinaryWriter writer, ulong size)
    {
        writer.Write((ushort)1); writer.Write((ushort)8); writer.Write(size);
    }

    private static byte[] CountFixture(int count)
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, true))
            for (var index = 0; index < count; index++) archive.CreateEntry($"empty-{index:D3}");
        return buffer.ToArray();
    }

    private static byte[] HighlyCompressed(int uncompressedBytes)
    {
        using var buffer = new MemoryStream();
        using (var archive = new ZipArchive(buffer, ZipArchiveMode.Create, true))
        {
            using var output = archive.CreateEntry("manifest.json", CompressionLevel.SmallestSize).Open();
            var zeros = new byte[64 * 1024];
            for (var remaining = uncompressedBytes; remaining > 0; remaining -= Math.Min(remaining, zeros.Length))
                output.Write(zeros, 0, Math.Min(remaining, zeros.Length));
        }
        return buffer.ToArray();
    }
}
