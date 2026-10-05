using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using System.Security.Cryptography.Xml;
using System.Xml;
using Fylkren.Api.Identity;
using Fylkren.Api.Networking;
using Fylkren.Api.Platform;
using Microsoft.Extensions.Options;
using Sustainsys.Saml2;
using Sustainsys.Saml2.Metadata;
using Sustainsys.Saml2.AspNetCore2;
using Sustainsys.Saml2.Configuration;

internal static class SamlMetadataTests
{
    internal static async Task Run()
    {
        using var rsa = RSA.Create(3072);
        var request = new CertificateRequest("CN=Synthetic SAML signing key", rsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        using var certificate = request.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
        var clock = new TestClock();
        var expires = clock.GetUtcNow().AddHours(1);
        string Document(string entity = "https://idp.test/realm", string signIn = "https://idp.test/sso") => $"""
            <EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="{entity}" validUntil="{expires:yyyy-MM-ddTHH:mm:ssZ}">
              <IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
                <KeyDescriptor use="signing"><KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><X509Data><X509Certificate>{Convert.ToBase64String(certificate.RawData)}</X509Certificate></X509Data></KeyInfo></KeyDescriptor>
                <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="{signIn}"/>
              </IDPSSODescriptor>
            </EntityDescriptor>
            """;
        var signedDocument = new XmlDocument { PreserveWhitespace = true, XmlResolver = null };
        signedDocument.LoadXml(Document());
        var signed = new SignedXml(signedDocument) { SigningKey = rsa };
        signed.SignedInfo!.SignatureMethod = SignedXml.XmlDsigRSASHA256Url;
        var reference = new Reference("") { DigestMethod = SignedXml.XmlDsigSHA256Url };
        reference.AddTransform(new XmlDsigEnvelopedSignatureTransform());
        signed.AddReference(reference);
        signed.KeyInfo = new KeyInfo(); signed.KeyInfo.AddClause(new KeyInfoX509Data(certificate));
        signed.ComputeSignature();
        signedDocument.DocumentElement!.PrependChild(signedDocument.ImportNode(signed.GetXml(), true));
        var body = signedDocument.OuterXml;
        var calls = 0;
        using var transport = new ResponseHandler(() => { calls++; return body; });
        using var cache = new SamlMetadataCache(new Factory(transport), new OptionsCache<Saml2Options>(), new OutboundHttpPolicy(""), clock);
        var options = new SamlOptions { Enabled = true, MetadataUrl = "https://idp.test/metadata", IdentityProviderEntityId = "https://idp.test/realm" };
        await cache.Prepare(options, default);
        var original = cache.Prepared(options);
        var idp = new IdentityProvider(new EntityId(options.IdentityProviderEntityId), new SPOptions());
        idp.ReadMetadata(original);
        Require(idp.SigningKeys.Count() == 1, "Signing certificate was lost during bounded metadata parsing.");
        await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => cache.Prepare(options, default)));
        Require(calls == 1, "Concurrent challenges duplicated valid metadata downloads.");
        using (var weakRsa = RSA.Create(2048))
        {
            var weakRequest = new CertificateRequest("CN=Weak synthetic SAML signing key", weakRsa, HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
            using var weakCertificate = weakRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddDays(-1), DateTimeOffset.UtcNow.AddDays(1));
            options.MetadataUrl += "?weak-key";
            body = Document().Replace(Convert.ToBase64String(certificate.RawData), Convert.ToBase64String(weakCertificate.RawData));
            await RejectAsync(() => cache.Prepare(options, default));
            Reject(() => cache.Prepared(options));
            body = Document();
            options.MetadataUrl = "https://idp.test/metadata";
            await cache.Prepare(options, default);
        }
        var callsBeforeExpiry = calls;
        clock.Advance(TimeSpan.FromMinutes(16));
        Reject(() => cache.Prepared(options));
        await cache.Prepare(options, default);
        Require(calls == callsBeforeExpiry + 1 && !ReferenceEquals(original, cache.Prepared(options)), "Expired cache did not renew metadata.");
        options.MetadataUrl += "?revision=2";
        Reject(() => cache.Prepared(options));
        body = Document("https://other-idp.test/realm");
        await RejectAsync(() => cache.Prepare(options, default));
        Reject(() => cache.Prepared(options));
        body = Document();
        await cache.Prepare(options, default);
        options.MetadataUrl += "?revision=foreign-sso";
        body = Document(signIn: "https://other-idp.test/sso");
        await RejectAsync(() => cache.Prepare(options, default));
        Reject(() => cache.Prepared(options));
        body = Document();
        await cache.Prepare(options, default);
        clock.Advance(TimeSpan.FromHours(2));
        await RejectAsync(() => cache.Prepare(options, default));
        Reject(() => cache.Prepared(options));
        Console.WriteLine("SAML metadata cache tests passed: signed metadata compatibility/signing key preserved, concurrent cache reuse, expiration/renewal, configuration isolation, mismatched identity and expired metadata fail closed without stale fallback.");
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    private static void Reject(Action action) { try { action(); } catch (HttpRequestException) { return; } throw new Exception("Invalid metadata remained available."); }
    private static async Task RejectAsync(Func<Task> action) { try { await action(); } catch (HttpRequestException) { return; } throw new Exception("Invalid metadata accepted."); }
    private sealed class TestClock : TimeProvider
    {
        private DateTimeOffset now = DateTimeOffset.UtcNow;
        public override DateTimeOffset GetUtcNow() => now;
        public void Advance(TimeSpan span) => now += span;
    }
    private sealed class Factory(HttpMessageHandler transport) : IHttpClientFactory { public HttpClient CreateClient(string name) => new(transport, disposeHandler: false); }
    private sealed class ResponseHandler(Func<string> value) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(value()) });
    }
}
