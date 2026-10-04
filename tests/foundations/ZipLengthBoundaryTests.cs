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
        Console.WriteLine("ZIP64 boundary tests passed: tiny fixtures expose real declared lengths; overflow, unsigned maximum and aggregate size reject before extraction; exact limit and zero proceed to manifest validation.");
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
}
