using System.Net;

namespace Fylkren.Api.Networking;

internal sealed class BoundedResponseHandler(HttpMessageHandler inner, long? limit, Action<Uri>? validate = null, bool rejectRedirects = false) : DelegatingHandler(inner)
{
    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (request.RequestUri is not { } uri) throw new HttpRequestException("Invalid outbound URL.");
        if (validate is null)
        {
            if (!OutboundHttpPolicy.ValidUri(uri)) throw new HttpRequestException("Invalid outbound URL.");
        }
        else validate(uri);
        var response = await base.SendAsync(request, ct);
        if (rejectRedirects && (int)response.StatusCode is >= 300 and <= 399)
        { response.Dispose(); throw new HttpRequestException("Identity-provider redirects are not permitted."); }
        if (limit is long maximum && response.Content.Headers.ContentLength > maximum) { response.Dispose(); throw new HttpRequestException("Outbound response exceeds the allowed size."); }
        if (limit is long bound) response.Content = new LimitedContent(response.Content, bound);
        return response;
    }
    private sealed class LimitedContent : HttpContent
    {
        private readonly HttpContent inner;
        private readonly long limit;
        internal LimitedContent(HttpContent content, long maximum)
        {
            inner = content; limit = maximum;
            foreach (var h in content.Headers) Headers.TryAddWithoutValidation(h.Key, h.Value);
        }
        protected override bool TryComputeLength(out long length) { length = inner.Headers.ContentLength ?? 0; return inner.Headers.ContentLength.HasValue; }
        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context) => await SerializeToStreamAsync(stream, context, default);
        protected override async Task SerializeToStreamAsync(Stream stream, TransportContext? context, CancellationToken ct)
        {
            await using var source = await CreateContentReadStreamAsync(ct);
            await source.CopyToAsync(stream, ct);
        }
        protected override async Task<Stream> CreateContentReadStreamAsync() => await CreateContentReadStreamAsync(default);
        protected override async Task<Stream> CreateContentReadStreamAsync(CancellationToken ct) => new LimitedStream(await inner.ReadAsStreamAsync(ct), limit);
        protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); base.Dispose(disposing); }
    }
    private sealed class LimitedStream(Stream inner, long limit) : Stream
    {
        private long consumed;
        public override bool CanRead => true; public override bool CanWrite => false; public override bool CanSeek => false;
        public override long Length => throw new NotSupportedException(); public override long Position { get => consumed; set => throw new NotSupportedException(); }
        public override void Flush() { }
        public override int Read(byte[] buffer, int offset, int count) => Check(inner.Read(buffer, offset, Math.Min(count, Remaining())));
        public override async ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default) => Check(await inner.ReadAsync(buffer[..Math.Min(buffer.Length, Remaining())], ct));
        public override Task<int> ReadAsync(byte[] buffer, int offset, int count, CancellationToken ct) => ReadAsync(buffer.AsMemory(offset, count), ct).AsTask();
        private int Remaining() => consumed > limit ? throw new HttpRequestException("Response size limit already exceeded.") : (int)Math.Min(16_384, limit - consumed + 1);
        private int Check(int read) { consumed = checked(consumed + read); if (consumed > limit) throw new HttpRequestException("Outbound response exceeds the allowed size."); return read; }
        public override long Seek(long offset, SeekOrigin origin) => throw new NotSupportedException(); public override void SetLength(long value) => throw new NotSupportedException(); public override void Write(byte[] buffer, int offset, int count) => throw new NotSupportedException();
        protected override void Dispose(bool disposing) { if (disposing) inner.Dispose(); base.Dispose(disposing); }
        public override async ValueTask DisposeAsync() { await inner.DisposeAsync(); GC.SuppressFinalize(this); }
    }
}
