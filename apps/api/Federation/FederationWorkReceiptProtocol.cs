using System.Globalization;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationWorkReceipt(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, Guid MessageId, Guid Nonce, Guid SourceSiteId,
    Guid DestinationSiteId, Guid LocalWorkItemId, string PayloadSha256,
    long GrantRevision, bool Duplicate, long Timestamp, string Signature,
    string? SignatureAlgorithm = null);

internal static class FederationWorkReceiptProtocol
{
    internal static byte[] SignedBytes(FederationWorkReceipt receipt) =>
        Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose("fylkren-federation-work-receipt-v1",
                receipt.SignatureAlgorithm),
            receipt.SchemaVersion.ToString(CultureInfo.InvariantCulture),
            receipt.SenderInstanceId.ToString("N"), receipt.RecipientInstanceId.ToString("N"),
            receipt.MessageId.ToString("N"), receipt.Nonce.ToString("N"),
            receipt.SourceSiteId.ToString("N"), receipt.DestinationSiteId.ToString("N"),
            receipt.LocalWorkItemId.ToString("N"), receipt.PayloadSha256,
            receipt.GrantRevision.ToString(CultureInfo.InvariantCulture),
            receipt.Duplicate ? "1" : "0", receipt.Timestamp.ToString(CultureInfo.InvariantCulture)
        }.Concat(FederationSignatureProtocol.Bind(receipt.SignatureAlgorithm))));
}
