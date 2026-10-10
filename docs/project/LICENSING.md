# Licensing and editions

## Source-available software license

The current project-authored Fylkren source and documentation are made
available under the [Fylkren Source Available License 1.0](../../LICENSE),
unless a file says otherwise. Fylkren is **source-available**, not open source.
The exact applicable terms are in `LICENSE`; this page is an orientation, not a
substitute for those terms. [NOTICE.md](../../NOTICE.md) identifies
THUNOLD-OLSEN (Norwegian organization number 996871126) as the copyright holder.
Third-party material keeps its own terms; see
[third-party notices](THIRD_PARTY_NOTICES.md).

## Intended license boundary

The license deliberately permits copying, modification and redistribution when
its terms and notices follow the software. Redistribution alone is not an
infringement. Independent consulting, deployment, integration, training and
support are not treated as competing products merely because they support
authorized Fylkren installations.

The license does not allow a distributor to remove or misrepresent Fylkren's
authorship or provenance. A recipient may not rename or rebrand Fylkren or a
substantially derived work and present it as an independently created product.
An allowed modified distribution must identify itself as an unofficial modified
version based on Fylkren by THUNOLD-OLSEN, identify its distributor and material
changes, and avoid implying official approval or support.

The other restricted act is Enterprise circumvention: a recipient may not use
or provide an Enterprise capability without a valid entitlement, alter the
product to treat an unauthorized capability as authorized, or create or
distribute a practical bypass. Controlled good-faith security and
interoperability testing remain allowed within the stated boundary, and
mandatory statutory rights are preserved.

This is the intended commercial policy. Qualified counsel must still verify the
exact license and matching customer terms before public release, including
enforceability, mandatory software rights, copyright ownership and the effect
of the earlier MPL-2.0 history. That review is a verification gate, not an
unresolved product-policy choice.

## Software license versus feature entitlement

Community and Enterprise share one repository, codebase, set of API/web images,
database schema and upgrade path. A customer can run Community offline without
a license file. A valid signed offline Enterprise license activates only the
entitlements specified for that installation. Runtime entitlement checks and
the software license are separate; neither a UI control nor an Enterprise label
changes the terms of `LICENSE`. See the
[edition architecture](../architecture/EDITION_ENTITLEMENTS.md) for the
centralized allocation and safe downgrade behavior.

The repository contains the production **public** verification key,
public-key verification code and test-only pre-signed fixtures, but **no
production private signing key or license-generation capability**. The separate
private `thunold-olsen-licensing` repository handles issuance, private keys and
commercial backend logic. Its boundary with this repository is the documented
signed envelope and verifier contract; it is not a second Fylkren product or
code fork. Customers can follow the
[connected or air-gapped Enterprise license procedure](../operations/GET_ENTERPRISE_LICENSE.md).

## Brand and participation

The Fylkren name and logo are addressed separately in
[TRADEMARKS.md](../../TRADEMARKS.md). Accurate identification of genuine
installations and independent consulting, integration, deployment, training and
support are welcome under that guidance; third parties must not imply
endorsement, ownership, or original authorship.

GitHub Issues may be used for bugs, ideas and discussion once the repository is
public. There is no external code-contribution or pull-request program at this
stage. Security reports must follow [SECURITY.md](../../SECURITY.md), not public
issues.

## Publication gate

Before opening the repository, complete the
[publication-readiness review](../../dev-notes/project/PUBLICATION_READINESS.md), including legal
verification of the source license and matching customer terms, review of the
previous MPL-2.0 history, copyright ownership, third-party attributions,
history sanitization, security contact and final Community/Enterprise release
tests. Changing today's `LICENSE` does not itself erase earlier commits or
settle rights attached to older distributions.
