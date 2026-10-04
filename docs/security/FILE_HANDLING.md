# File handling boundary

This is the canonical inventory for files selected, uploaded, generated or downloaded by Fylkren. It documents the current implementation boundary and its limits. Operational document fields store links only; Fylkren has no general document-attachment store.

## File selection and upload inventory

| Feature | Server input | Permitted type and expected extension | Maximum | Unpacked maximum | Validation, storage and rejection |
| --- | --- | --- | ---: | ---: | --- |
| Profile image | Authenticated multipart field `image` at `PUT /api/profile/image` | PNG (`.png`, `image/png`), JPEG (`.jpg`/`.jpeg`, `image/jpeg`) or WebP (`.webp`, `image/webp`) | 2 MiB | Not compressed | The API requires a non-empty file, matches the declared media type to PNG/JPEG/WebP signature bytes and ignores the client filename for storage. Invalid, mismatched, active-text and oversized input returns a validation error and is not persisted. Valid bytes and the detected fixed media type are stored in PostgreSQL as person data. |
| Branding logo | Platform Manager multipart field `logo` at `PUT /api/platform/branding/logo` | PNG (`.png`, `image/png`), JPEG (`.jpg`/`.jpeg`, `image/jpeg`) or WebP (`.webp`, `image/webp`) | 2 MiB | Not compressed | Uses the same signature/media-type check as profile images and never creates a client-named path. Rejected input leaves the current logo unchanged. Valid bytes and the fixed detected type are stored in PostgreSQL. |
| Portable package validation | Authorized multipart field `package` at `POST /api/portability/sites/{siteId}/imports/validate` | Fylkren ZIP (`.zip`, `application/zip`) containing `manifest.json`, optional `README.txt`, declared `data/*.jsonl` and declared `attachments/*` | 16 MiB ZIP; 17 MiB request allowance for multipart overhead | 16 MiB aggregate declared entry length; 250 entries | One package is buffered/validated at a time. The validator checks ZIP parsing, entry count and lengths before opening entries, unsafe/duplicate paths, manifest shape/version/site, declared sizes and SHA-256, JSON object/record/reference bounds and required datasets. Invalid packages return `valid: false`, create only the rejection audit and never apply data. Entries are streamed/read for validation and are never extracted to a filesystem or served from the package. |
| Enterprise licence selection | Platform Manager browser file control; the file itself is not sent as multipart | JSON (`.json`, `application/json`) with string `payload` and `signature` | 32,000 bytes in the browser | Not compressed | The browser parses the selected file and sends only the two strings as JSON. The server verifies the signed licence, instance binding, validity and supported claims. Invalid content does not activate entitlements. |
| Export custody confirmation | Archive browser file control; the file itself is not sent to the server | Fylkren ZIP (`.zip`, `application/zip`) matching a recorded export receipt | 16 MiB and exactly the receipt byte count | Not opened or unpacked | The browser calculates SHA-256 and sends only the digest, receipt version and reason. A size/digest mismatch is rejected before the acknowledgement request. This confirms custody; it does not validate or import the package. |

Browser `accept` filters guide file selection but are not security controls. Server-side rules above are authoritative. The image endpoints currently use signature recognition rather than trusting an extension, while the portability validator parses the archive rather than trusting its name. Extension-to-content enforcement is tracked separately under ASVS 5.2.2.

## Generated and stored downloads

| Output | Filename and media type | Access and safe handling |
| --- | --- | --- |
| Profile image | No caller-controlled download filename; fixed detected `image/png`, `image/jpeg` or `image/webp` | Requires the image owner's authenticated session. Bytes come from PostgreSQL, range processing is disabled and the response receives the common `nosniff` and restrictive CSP policy. |
| Branding logo | No caller-controlled download filename; fixed detected raster media type | Public for pre-sign-in branding. Bytes come from PostgreSQL under the stored detected type and receive `nosniff` and the common browser policy. SVG and arbitrary active types are not accepted. |
| Portable Site export | Server-generated `fylkren-site-{32 lowercase hexadecimal UUID characters}-export.zip`, `application/zip`, attachment disposition | Created from a repeatable-read snapshot, limited to 16 MiB/250 entries and validated before delivery. The filename contains only a server-parsed UUID. The response uses attachment disposition and `nosniff`; the ZIP remains customer data and should be handled according to the receiving organization's classification and malware-scanning policy. |

Print-to-PDF is performed by the user's browser and is not a server file upload or stored server artifact. Backup archives are operator-created recovery artifacts on the server, not HTTP uploads or end-user downloads.

## Malicious-content behavior and present limits

Fylkren rejects disguised active text when it does not match an allowed raster signature and never stores an uploaded file under a client-controlled executable path. It does not currently decode and re-encode raster images, inspect complete image structure, or run an antivirus engine. A file with an allowed leading signature can therefore require downstream malware controls even though browsers receive a fixed image media type and `nosniff`.

Portable validation treats the entire ZIP as untrusted structured input. It bounds and verifies it without filesystem extraction and does not make its files downloadable through Fylkren. Validation is not antivirus scanning and is not an import/apply operation. Current attachment descriptors are checked for owner, path, length and SHA-256 but their declared media type, extension and content signature are not yet cross-validated. ASVS 5.2.2, 5.2.3 and 5.4.3 remain open until their own implementation and execution evidence is complete.

If a future feature accepts operational attachments, enables package application, serves package entries, adds a file type, changes a size limit or introduces HTTP/2/3 upload paths, update this inventory and reopen the affected ASVS rows before release.
