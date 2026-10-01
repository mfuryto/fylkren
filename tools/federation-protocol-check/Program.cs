using System.Security.Cryptography;
using System.Net.Http.Json;
using Fylkren.Api.Federation;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;

var assertions = 0;
var lifecycleNow = DateTimeOffset.UtcNow;
var lifecycleLink = new ExternalIdentityLink(Guid.NewGuid(), Guid.NewGuid(), "ad",
    Guid.NewGuid().ToString("D"), "synthetic.user", lifecycleNow);
Check(lifecycleLink.DirectoryAccessEnabled && lifecycleLink.DirectoryLifecycleStatus == "active",
    "directory link starts active after authoritative linking");
Check(!lifecycleLink.RecordDirectoryMissing(lifecycleNow.AddMinutes(1), 3) &&
    lifecycleLink.DirectoryMissingCount == 1 && lifecycleLink.DirectoryAccessEnabled,
    "single missing directory result does not suspend access");
lifecycleLink.RecordDirectoryUnavailable(lifecycleNow.AddMinutes(2));
Check(lifecycleLink.DirectoryMissingCount == 0 && lifecycleLink.DirectoryAccessEnabled,
    "directory outage resets missing confirmation without suspending access");
Check(!lifecycleLink.RecordDirectoryMissing(lifecycleNow.AddMinutes(3), 3) &&
    !lifecycleLink.RecordDirectoryMissing(lifecycleNow.AddMinutes(4), 3) &&
    lifecycleLink.RecordDirectoryMissing(lifecycleNow.AddMinutes(5), 3) &&
    !lifecycleLink.DirectoryAccessEnabled && lifecycleLink.DirectoryLifecycleStatus == "missing" &&
    lifecycleLink.DirectoryMissingCount == 3 && lifecycleLink.DirectorySuspendedAt == lifecycleNow.AddMinutes(5),
    "confirmed missing directory account suspends access");
Check(!lifecycleLink.RecordDirectoryMissing(lifecycleNow.AddMinutes(5.5), 3) &&
    lifecycleLink.DirectoryMissingCount == 3,
    "repeated missing result remains capped and does not repeat the suspension transition");
Check(lifecycleLink.RecordDirectoryActive("renamed.user", lifecycleNow.AddMinutes(6)) &&
    lifecycleLink.DirectoryAccessEnabled && lifecycleLink.Username == "renamed.user" &&
    lifecycleLink.DirectorySuspendedAt is null &&
    lifecycleLink.DirectoryLastSuccessfulSyncAt == lifecycleNow.AddMinutes(6),
    "authoritative active result resumes the same link");
Check(lifecycleLink.RecordDirectoryDisabled("disabled", lifecycleNow.AddMinutes(7)) &&
    !lifecycleLink.DirectoryAccessEnabled && lifecycleLink.DirectoryLifecycleStatus == "disabled",
    "explicit disabled result suspends immediately");
var lifecycleAudit = AuditEvent.FromSystem(Guid.NewGuid(), "directory-lifecycle",
    "identity.directory.account-suspended", "external-identity-link", lifecycleLink.Id,
    lifecycleNow.AddMinutes(7));
Check(lifecycleAudit.ActorSystem == "directory-lifecycle" && lifecycleAudit.ActorPersonId is null,
    "directory lifecycle transition has a durable system audit actor");
using var signingKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
var publicKey = signingKey.ExportSubjectPublicKeyInfo();
var encoded = Convert.ToBase64String(publicKey);
Check(FederationPublicKey.TryParse(encoded, out var parsed, out var fingerprint), "P-256 key parses");
Check(parsed.AsSpan().SequenceEqual(publicKey), "SPKI bytes preserved");
Check(fingerprint == Convert.ToHexString(SHA256.HashData(publicKey)).ToLowerInvariant(), "fingerprint matches DER");
Check(!FederationPublicKey.TryParse("invalid", out _, out _), "malformed SPKI rejected");

var sender = Guid.NewGuid();
var recipient = Guid.NewGuid();
var nonce = Guid.NewGuid();
var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
var request = FederationProbeProtocol.RequestBytes(sender, recipient, timestamp, nonce);
var signature = FederationProbeProtocol.Sign(signingKey, request);
Check(FederationProbeProtocol.Verify(publicKey, request, signature), "valid request accepted");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationProbeProtocol.RequestBytes(recipient, sender, timestamp, nonce), signature), "swapped identities rejected");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationProbeProtocol.RequestBytes(sender, recipient, timestamp, Guid.NewGuid()), signature), "changed nonce rejected");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationProbeProtocol.RequestBytes(sender, recipient, timestamp + 1, nonce), signature), "changed timestamp rejected");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationProbeProtocol.ResponseBytes(sender, recipient, timestamp, nonce), signature), "request signature cannot sign response");
Check(!FederationProbeProtocol.Verify(publicKey, request, "invalid"), "malformed signature rejected");
using var otherKey = ECDsa.Create(ECCurve.NamedCurves.nistP256);
Check(!FederationProbeProtocol.Verify(otherKey.ExportSubjectPublicKeyInfo(), request, signature), "wrong peer key rejected");
var discovery = FederationIdentityDiscoveryProtocol.ResponseBytes(recipient, sender,
    timestamp, nonce, fingerprint);
var discoverySignature = FederationProbeProtocol.Sign(signingKey, discovery);
Check(FederationProbeProtocol.Verify(publicKey, discovery, discoverySignature),
    "signed identity discovery accepted");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationIdentityDiscoveryProtocol.ResponseBytes(recipient, Guid.NewGuid(),
        timestamp, nonce, fingerprint), discoverySignature),
    "identity discovery requester protected by signature");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationIdentityDiscoveryProtocol.ResponseBytes(recipient, sender,
        timestamp, nonce, new string('0', 64)), discoverySignature),
    "identity discovery fingerprint protected by signature");
var capabilityOffer = new FederationCapabilityRequest(sender, recipient, 1, 1,
    [1], ["assignment.answered", "assignment.cancelled", "assignment.created",
        "assignment.progress"], timestamp, nonce, null);
var capabilitySignature = FederationProbeProtocol.Sign(signingKey,
    FederationCapabilityProtocol.RequestBytes(capabilityOffer));
Check(FederationCapabilityProtocol.ValidOffer(capabilityOffer),
    "ordered capability offer accepted");
Check(FederationProbeProtocol.Verify(publicKey,
    FederationCapabilityProtocol.RequestBytes(capabilityOffer), capabilitySignature),
    "capability offer signature accepted");
Check(!FederationCapabilityProtocol.ValidOffer(capabilityOffer with
    { WorkMessageTypes = ["assignment.progress", "assignment.created"] }),
    "unordered capability offer rejected");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationCapabilityProtocol.RequestBytes(capabilityOffer with
        { MaximumProtocolVersion = 2 }), capabilitySignature),
    "capability version protected by signature");
var capabilitySelection = new FederationCapabilityResponse(recipient, sender, 1, 1,
    ["assignment.created"], timestamp, nonce, string.Empty);
capabilitySelection = capabilitySelection with { Signature = FederationProbeProtocol.Sign(otherKey,
    FederationCapabilityProtocol.ResponseBytes(capabilitySelection)) };
Check(FederationCapabilityProtocol.ValidSelection(capabilitySelection, capabilityOffer),
    "compatible capability selection accepted");
Check(FederationProbeProtocol.Verify(otherKey.ExportSubjectPublicKeyInfo(),
    FederationCapabilityProtocol.ResponseBytes(capabilitySelection),
    capabilitySelection.Signature), "capability selection signature accepted");
var rotationId = Guid.NewGuid();
var newPublicKey = otherKey.ExportSubjectPublicKeyInfo();
var newFingerprint = Convert.ToHexString(SHA256.HashData(newPublicKey)).ToLowerInvariant();
var rotation = FederationKeyRotationProtocol.StageBytes(sender, recipient, rotationId,
    timestamp, nonce, fingerprint, newFingerprint);
var currentRotationSignature = FederationKeyRotationProtocol.Sign(signingKey, rotation);
var newRotationSignature = FederationKeyRotationProtocol.Sign(otherKey, rotation);
Check(FederationKeyRotationProtocol.Verify(publicKey, rotation, currentRotationSignature),
    "current key authorizes rotation");
Check(FederationKeyRotationProtocol.Verify(newPublicKey, rotation, newRotationSignature),
    "new key proves rotation possession");
Check(!FederationKeyRotationProtocol.Verify(newPublicKey, rotation, currentRotationSignature),
    "current-key proof cannot impersonate new key");
Check(!FederationKeyRotationProtocol.Verify(publicKey,
    FederationKeyRotationProtocol.StageBytes(sender, recipient, Guid.NewGuid(), timestamp,
        nonce, fingerprint, newFingerprint), currentRotationSignature),
    "rotation ID protected by signature");
Check(!FederationKeyRotationProtocol.Verify(publicKey,
    FederationKeyRotationProtocol.StageBytes(sender, recipient, rotationId, timestamp,
        nonce, newFingerprint, fingerprint), currentRotationSignature),
    "rotation key order protected by signature");
Check(!FederationKeyRotationProtocol.Verify(publicKey,
    FederationKeyRotationProtocol.StageBytes(sender, Guid.NewGuid(), rotationId, timestamp,
        nonce, fingerprint, newFingerprint), currentRotationSignature),
    "rotation recipient protected by signature");
Check(!FederationKeyRotationProtocol.Verify(publicKey, request, currentRotationSignature),
    "key rotation and probe purposes separated");
var complete = FederationKeyRotationProtocol.CompleteBytes(sender, recipient, rotationId,
    timestamp, nonce);
var completeSignature = FederationKeyRotationProtocol.Sign(otherKey, complete);
Check(FederationKeyRotationProtocol.Verify(newPublicKey, complete, completeSignature),
    "new key authorizes rotation completion");
Check(!FederationKeyRotationProtocol.Verify(newPublicKey, rotation, completeSignature),
    "rotation phases have separate signature purposes");

var response = FederationProbeProtocol.ResponseBytes(recipient, sender, timestamp, nonce);
var recipientPublicKey = otherKey.ExportSubjectPublicKeyInfo();
var responseSignature = FederationProbeProtocol.Sign(otherKey, response);
Check(FederationProbeProtocol.Verify(recipientPublicKey, response, responseSignature), "valid response accepted from recipient key");
Check(!FederationProbeProtocol.Verify(publicKey, response, responseSignature), "sender key cannot impersonate recipient");
using var json = JsonContent.Create(new FederationProbeRequest(sender, recipient, timestamp, nonce, signature));
var decoded = await json.ReadFromJsonAsync<FederationProbeRequest>();
Check(decoded?.Nonce == nonce && decoded.SenderInstanceId == sender && decoded.Signature == signature,
    "request JSON round trip");
var sites = new[] { new FederationCatalogSite(Guid.NewGuid(), "Toppsite", 1, true) };
Check(FederationCatalogProtocol.ValidSites(sites), "top-level catalog entry accepted");
Check(!FederationCatalogProtocol.ValidSites([sites[0], sites[0]]), "duplicate site ID rejected");
var catalogRequest = FederationCatalogProtocol.RequestBytes(sender, recipient, timestamp, nonce);
var catalogRequestSignature = FederationProbeProtocol.Sign(signingKey, catalogRequest);
Check(FederationProbeProtocol.Verify(publicKey, catalogRequest, catalogRequestSignature), "catalog request signed");
Check(!FederationProbeProtocol.Verify(publicKey, request, catalogRequestSignature), "catalog and probe purposes separated");
var catalogResponse = FederationCatalogProtocol.ResponseBytes(recipient, sender, timestamp, nonce, sites);
var catalogSignature = FederationProbeProtocol.Sign(otherKey, catalogResponse);
Check(FederationProbeProtocol.Verify(recipientPublicKey, catalogResponse, catalogSignature), "catalog response signed by recipient");
Check(!FederationProbeProtocol.Verify(publicKey, catalogResponse, catalogSignature), "sender key cannot impersonate catalog responder");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationCatalogProtocol.ResponseBytes(recipient, sender, timestamp, nonce,
        [sites[0] with { Name = "Changed" }]), catalogSignature), "site name protected by signature");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationCatalogProtocol.ResponseBytes(recipient, sender, timestamp, nonce,
        [sites[0] with { IsActive = false }]), catalogSignature), "publication state protected by signature");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationCatalogProtocol.ResponseBytes(recipient, sender, timestamp, nonce,
        [sites[0] with { Revision = 2 }]), catalogSignature), "revision protected by signature");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationCatalogProtocol.ResponseBytes(recipient, sender, timestamp, Guid.NewGuid(), sites), catalogSignature),
    "catalog nonce protected by signature");
var remote = new FederationRemoteSite(sender, sites[0].SiteId, "Original", 2, true, DateTimeOffset.UtcNow);
Check(!remote.ApplySnapshot("Stale", 1, true, DateTimeOffset.UtcNow), "older catalog revision ignored");
Check(remote.Name == "Original", "stale catalog did not change name");
Check(remote.Suspend(DateTimeOffset.UtcNow) && !remote.IsActive, "omitted site suspended");
Check(!remote.ApplySnapshot("Old", 2, true, DateTimeOffset.UtcNow), "same revision cannot revive suspended site");
Check(remote.ApplySnapshot("New", 3, true, DateTimeOffset.UtcNow) && remote.IsActive,
    "newer revision can restore site");
var grant = new FederationSiteGrant(Guid.NewGuid(), sender, sites[0].SiteId, Guid.NewGuid(),
    "outbound", DateTimeOffset.UtcNow);
Check(grant.IsActive && grant.Revision == 1, "new grant starts active at first revision");
Check(grant.SetActive(false, DateTimeOffset.UtcNow) && grant.Revision == 2, "grant revocation advances revision");
Check(!grant.SetActive(false, DateTimeOffset.UtcNow) && grant.Revision == 2, "repeated revocation is inert");
Check(grant.SetActive(true, DateTimeOffset.UtcNow) && grant.Revision == 3, "explicit reactivation advances revision");
var sourceSite = Guid.NewGuid();
var destinationSite = Guid.NewGuid();
var grantRequest = FederationGrantCheckProtocol.RequestBytes(sender, recipient, timestamp, nonce,
    sourceSite, destinationSite);
var grantRequestSignature = FederationProbeProtocol.Sign(signingKey, grantRequest);
Check(FederationProbeProtocol.Verify(publicKey, grantRequest, grantRequestSignature), "grant check request signed by sender");
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationGrantCheckProtocol.RequestBytes(sender, recipient, timestamp, nonce,
        destinationSite, sourceSite), grantRequestSignature), "grant check site direction protected");
Check(!FederationProbeProtocol.Verify(publicKey, request, grantRequestSignature), "grant check purpose separated from probe");
var grantResponse = FederationGrantCheckProtocol.ResponseBytes(recipient, sender, timestamp, nonce,
    sourceSite, destinationSite, true, 3);
var grantResponseSignature = FederationProbeProtocol.Sign(otherKey, grantResponse);
Check(FederationProbeProtocol.Verify(recipientPublicKey, grantResponse, grantResponseSignature),
    "grant check response signed by recipient");
Check(!FederationProbeProtocol.Verify(publicKey, grantResponse, grantResponseSignature),
    "sender cannot impersonate grant decision");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationGrantCheckProtocol.ResponseBytes(recipient, sender, timestamp, nonce,
        sourceSite, destinationSite, false, null), grantResponseSignature), "grant decision protected");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationGrantCheckProtocol.ResponseBytes(recipient, sender, timestamp, nonce,
        sourceSite, destinationSite, true, 4), grantResponseSignature), "grant revision protected");
Check(FederationGrantCheckProtocol.ValidDecision(true, 3), "positive grant decision requires revision");
Check(FederationGrantCheckProtocol.ValidDecision(false, null), "negative grant decision has no revision");
Check(!FederationGrantCheckProtocol.ValidDecision(true, null), "unsigned positive revision rejected");
Check(!FederationGrantCheckProtocol.ValidDecision(false, 3), "negative decision cannot carry revision");
var work = new FederationWorkEnvelope(1, Guid.NewGuid(), "assignment.created", sender, recipient,
    sourceSite, destinationSite, sender, sourceSite, Guid.NewGuid(), null, Guid.NewGuid(), null,
    timestamp, Guid.NewGuid(), "{\"title\":\"Test\"}", null);
Check(FederationWorkProtocol.ValidEnvelope(work), "valid work envelope accepted");
var workBytes = FederationWorkProtocol.SignedBytes(work);
var workSignature = FederationProbeProtocol.Sign(signingKey, workBytes);
Check(FederationProbeProtocol.Verify(publicKey, workBytes, workSignature), "work envelope signature accepted");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { PayloadJson = "{\"title\":\"Altered\"}" }), workSignature), "changed payload rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { DestinationSiteId = Guid.NewGuid() }), workSignature), "changed destination rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { OriginResourceId = Guid.NewGuid() }), workSignature), "changed origin rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { MessageId = Guid.NewGuid() }), workSignature), "changed message ID rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { Nonce = Guid.NewGuid() }), workSignature), "changed transport nonce rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { CounterpartWorkItemId = Guid.NewGuid() }), workSignature), "changed counterpart rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationWorkProtocol.SignedBytes(work with
    { CorrelationId = Guid.NewGuid() }), workSignature), "changed correlation rejected");
Check(!FederationProbeProtocol.Verify(publicKey, FederationProbeProtocol.RequestBytes(sender,
    recipient, timestamp, work.Nonce), workSignature), "work signature cannot sign probe");
Check(!FederationWorkProtocol.ValidEnvelope(work with { SenderInstanceId = recipient }), "self-addressed work rejected");
Check(!FederationWorkProtocol.ValidEnvelope(work with { MessageType = "Assignment.Created" }), "invalid message type rejected");
Check(!FederationWorkProtocol.ValidEnvelope(work with { PayloadJson = new string('x', 256_001) }),
    "UTF-8 payload byte limit enforced");
var assignment = work with { PayloadJson = "{\"kind\":\"request\",\"title\":\"Synthetic request\",\"instruction\":\"Please assist\",\"priority\":\"normal\",\"dueAt\":null,\"requestBasis\":null,\"sourceTypeName\":null,\"senderName\":null}" };
Check(FederationAssignmentContract.TryDecode(assignment, out var decodedAssignment) &&
    decodedAssignment?.Title == "Synthetic request", "minimal assignment payload accepted");
Check(!FederationAssignmentContract.TryDecode(assignment with { OriginSiteId = Guid.NewGuid() }, out _),
    "assignment cannot claim a foreign origin site");
Check(!FederationAssignmentContract.TryDecode(assignment with { CounterpartWorkItemId = Guid.NewGuid() }, out _),
    "initial assignment cannot claim an existing counterpart");
Check(!FederationAssignmentContract.TryDecode(assignment with { PayloadJson = assignment.PayloadJson.Replace("\"normal\"", "\"urgent\"") }, out _),
    "unknown priority rejected");
Check(!FederationAssignmentContract.TryDecode(assignment with { PayloadJson = assignment.PayloadJson.Replace("\"senderName\":null", "\"localPersonId\":\"123\"") }, out _),
    "unexpected local identity field rejected");
var officialAnswerAt = DateTimeOffset.UtcNow;
var counterpartId = Guid.NewGuid();
var answerEnvelope = assignment with
{
    MessageId = Guid.NewGuid(), MessageType = "assignment.answered",
    SenderInstanceId = recipient, RecipientInstanceId = sender,
    SourceSiteId = destinationSite, DestinationSiteId = sourceSite,
    OriginInstanceId = sender, OriginSiteId = sourceSite,
    CounterpartWorkItemId = counterpartId,
    PayloadJson = System.Text.Json.JsonSerializer.Serialize(new FederationOfficialAnswerPayload(
        "Official answer", "SECRET", officialAnswerAt), new System.Text.Json.JsonSerializerOptions(
            System.Text.Json.JsonSerializerDefaults.Web))
};
Check(FederationOfficialAnswerContract.TryDecode(answerEnvelope, out var decodedAnswer) &&
    decodedAnswer?.OfficialReport == "Official answer" && decodedAnswer.Classification == "SECRET",
    "classified official answer payload accepted");
Check(!FederationOfficialAnswerContract.TryDecode(answerEnvelope with
    { CounterpartWorkItemId = null }, out _), "answer needs acknowledged counterpart");
Check(!FederationOfficialAnswerContract.TryDecode(answerEnvelope with
    { OriginInstanceId = recipient }, out _), "answer cannot change origin instance");
Check(!FederationOfficialAnswerContract.TryDecode(answerEnvelope with
    { PayloadJson = answerEnvelope.PayloadJson.Replace("\"officialReport\"", "\"subordinateReports\"") }, out _),
    "subordinate data is not accepted in official answer contract");
var answerSignature = FederationProbeProtocol.Sign(otherKey,
    FederationWorkProtocol.SignedBytes(answerEnvelope));
var progressEnvelope = answerEnvelope with
{
    MessageId = Guid.NewGuid(), MessageType = "assignment.progress",
    PayloadJson = "{\"phase\":\"under_review\",\"sequence\":1}"
};
Check(FederationProgressContract.TryDecode(progressEnvelope, out var decodedProgress) &&
    decodedProgress?.Sequence == 1, "coarse progress accepted");
Check(!FederationProgressContract.TryDecode(progressEnvelope with
    { PayloadJson = "{\"phase\":\"under_review\",\"sequence\":1,\"internalUnit\":\"secret\"}" }, out _),
    "internal unit cannot leak in progress payload");
Check(!FederationProgressContract.TryDecode(progressEnvelope with
    { PayloadJson = "{\"phase\":\"unknown\",\"sequence\":1}" }, out _),
    "unknown progress phase rejected");
var progressSignature = FederationProbeProtocol.Sign(otherKey,
    FederationWorkProtocol.SignedBytes(progressEnvelope));
var cancellationEnvelope = assignment with
{
    MessageId = Guid.NewGuid(), MessageType = "assignment.cancelled",
    CounterpartWorkItemId = counterpartId,
    PayloadJson = "{\"reason\":\"No longer required\"}"
};
Check(FederationCancellationContract.TryDecode(cancellationEnvelope, out var decodedCancellation) &&
    decodedCancellation?.Reason == "No longer required", "bounded cancellation accepted");
Check(!FederationCancellationContract.TryDecode(cancellationEnvelope with
    { PayloadJson = "{\"reason\":\"No longer required\",\"internalUnit\":\"secret\"}" }, out _),
    "internal detail rejected from cancellation payload");
Check(!FederationCancellationContract.TryDecode(cancellationEnvelope with
    { CounterpartWorkItemId = null }, out _), "cancellation requires acknowledged counterpart");
Check(!FederationCancellationContract.TryDecode(cancellationEnvelope with
    { OriginInstanceId = recipient }, out _), "cancellation cannot claim another origin");
var cancellationSignature = FederationProbeProtocol.Sign(signingKey,
    FederationWorkProtocol.SignedBytes(cancellationEnvelope));
Check(!FederationProbeProtocol.Verify(publicKey,
    FederationWorkProtocol.SignedBytes(cancellationEnvelope with
    { PayloadJson = "{\"reason\":\"Changed\"}" }), cancellationSignature),
    "cancellation reason protected by signature");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationWorkProtocol.SignedBytes(progressEnvelope with
    { PayloadJson = "{\"phase\":\"assigned\",\"sequence\":1}" }), progressSignature),
    "progress mutation invalidates signature");
var progressLink = new FederationWorkLink(Guid.NewGuid(), assignment.OriginResourceId,
    recipient, destinationSite, sender, sourceSite, assignment.OriginResourceId,
    "outgoing", DateTimeOffset.UtcNow);
Check(progressLink.ApplyProgress("under_review", 1, DateTimeOffset.UtcNow), "first progress applied");
Check(progressLink.ApplyProgress("assigned", 2, DateTimeOffset.UtcNow), "new progress applied");
Check(!progressLink.ApplyProgress("under_review", 1, DateTimeOffset.UtcNow) &&
    progressLink.RemoteProgressStatus == "assigned", "stale progress ignored");
Check(FederationProbeProtocol.Verify(recipientPublicKey,
    FederationWorkProtocol.SignedBytes(answerEnvelope), answerSignature), "official answer signature accepted");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationWorkProtocol.SignedBytes(answerEnvelope with { PayloadJson = answerEnvelope.PayloadJson.Replace(
        "Official answer", "Changed answer") }), answerSignature), "changed official answer rejected by signature");
var answeredLink = new FederationWorkLink(Guid.NewGuid(), assignment.OriginResourceId,
    recipient, destinationSite, sender, sourceSite, assignment.OriginResourceId,
    "outgoing", DateTimeOffset.UtcNow);
answeredLink.Acknowledge(counterpartId, DateTimeOffset.UtcNow);
answeredLink.RecordOfficialAnswer(answerEnvelope.MessageId, "Official answer", "SECRET",
    officialAnswerAt, "Receiving site");
Check(answeredLink.OfficialAnswer == "Official answer" &&
    answeredLink.OfficialAnswerClassification == "SECRET" &&
    answeredLink.OfficialAnswerMessageId == answerEnvelope.MessageId &&
    answeredLink.OfficialAnswerSiteName == "Receiving site", "official answer and site header stored on outgoing link");
try
{
    answeredLink.RecordOfficialAnswer(Guid.NewGuid(), "Replacement", "SECRET", officialAnswerAt,
        "Receiving site");
    throw new InvalidOperationException("Second official answer overwrote the first.");
}
catch (InvalidOperationException ex) when (ex.Message.Contains("immutable", StringComparison.Ordinal))
{
    Check(true, "second official answer cannot overwrite first");
}
var receipt = new FederationInboundReceipt(sender, assignment.MessageId, assignment.MessageType,
    sourceSite, destinationSite, assignment.OriginInstanceId, assignment.OriginSiteId,
    assignment.OriginResourceId, assignment.CorrelationId, assignment.CausationId,
    Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(assignment.PayloadJson))),
    Guid.NewGuid(), DateTimeOffset.UtcNow);
Check(receipt.PeerInstanceId == sender && receipt.MessageId == assignment.MessageId &&
    receipt.MessageType == assignment.MessageType && receipt.OriginResourceId == assignment.OriginResourceId &&
    receipt.PayloadSha256.Length == 64, "inbound receipt binds sender, message and payload");
var signedReceipt = new FederationWorkReceipt(1, recipient, sender, assignment.MessageId,
    assignment.Nonce, sourceSite, destinationSite, receipt.LocalWorkItemId,
    receipt.PayloadSha256, 2, false, timestamp, string.Empty);
var signedReceiptBytes = FederationWorkReceiptProtocol.SignedBytes(signedReceipt);
var signedReceiptSignature = FederationProbeProtocol.Sign(otherKey, signedReceiptBytes);
Check(FederationProbeProtocol.Verify(recipientPublicKey, signedReceiptBytes, signedReceiptSignature),
    "work acknowledgement signed by receiver");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationWorkReceiptProtocol.SignedBytes(signedReceipt with { LocalWorkItemId = Guid.NewGuid() }),
    signedReceiptSignature), "acknowledged local work ID protected by signature");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationWorkReceiptProtocol.SignedBytes(signedReceipt with { GrantRevision = 3 }),
    signedReceiptSignature), "acknowledgement grant revision protected by signature");
Check(!FederationProbeProtocol.Verify(recipientPublicKey,
    FederationWorkReceiptProtocol.SignedBytes(signedReceipt with { Duplicate = true }),
    signedReceiptSignature), "acknowledgement duplicate state protected by signature");
try
{
    _ = new FederationInboundReceipt(sender, assignment.MessageId, assignment.MessageType,
        sourceSite, destinationSite, assignment.OriginInstanceId, assignment.OriginSiteId,
        assignment.OriginResourceId, assignment.CorrelationId, assignment.CausationId,
        "bad-hash", Guid.NewGuid(), DateTimeOffset.UtcNow);
    throw new InvalidOperationException("Invalid receipt hash was accepted.");
}
catch (ArgumentException)
{
    Check(true, "malformed receipt hash rejected");
}
var externalAudit = AuditEvent.FromFederatedPeer(Guid.NewGuid(), destinationSite, sender,
    sourceSite, "Synthetic sender", "work-item.request-received", "work-item", Guid.NewGuid(),
    DateTimeOffset.UtcNow);
Check(externalAudit.ActorPersonId is null && externalAudit.ActorInstanceId == sender &&
    externalAudit.ActorSiteId == sourceSite && externalAudit.ActorSiteName == "Synthetic sender",
    "remote actor is preserved without local-person impersonation");
Check(!externalAudit.ActorWasPlatformManager, "remote actor is not a platform manager");
var localAudit = new AuditEvent(Guid.NewGuid(), destinationSite, Guid.NewGuid(),
    "work-item.registered", "work-item", Guid.NewGuid(), DateTimeOffset.UtcNow);
Check(localAudit.ActorPersonId.HasValue && localAudit.ActorInstanceId is null,
    "local actor remains separate from federated identity");
try
{
    AuditEvent.FromFederatedPeer(Guid.NewGuid(), destinationSite, sender, sourceSite,
        " ", "work-item.request-received", "work-item", Guid.NewGuid(), DateTimeOffset.UtcNow);
    throw new InvalidOperationException("Empty federated actor snapshot was accepted.");
}
catch (ArgumentException)
{
    Check(true, "empty federated actor snapshot rejected");
}
Console.WriteLine($"Federation protocol checks passed ({assertions} assertions).");

void Check(bool condition, string name)
{
    if (!condition) throw new InvalidOperationException($"Federation protocol check failed: {name}");
    assertions++;
}
