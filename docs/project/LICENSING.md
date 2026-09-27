# Licensing and editions

## Source-available software license

The current project-authored Fylkren source and documentation are made available under the unmodified [PolyForm Perimeter 1.0.0 license](../../LICENSE), unless a file says otherwise. Fylkren is **source-available**, not open source. The exact applicable terms are in `LICENSE`; this page is an orientation, not a substitute for those terms. [NOTICE.md](../../NOTICE.md) identifies THUNOLD-OLSEN (Norwegian organization number 996871126) as the copyright holder. Third-party material keeps its own terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

The license text contains an illustrative `Required Notice` example; that example is part of the official unmodified text, **not** Fylkren's copyright notice. The actual Fylkren notice is in `NOTICE.md`.

## Software license versus feature entitlement

Community and Enterprise share one repository, codebase, set of API/web images, database schema and upgrade path. A customer can run Community offline without a license file. A valid signed offline Enterprise license activates only the entitlements specified for that installation. Runtime entitlement checks and the software license are separate; neither a UI control nor an Enterprise label changes the terms of `LICENSE`. See the [edition architecture](../architecture/EDITION_ENTITLEMENTS.md) for the centralized allocation and safe downgrade behavior.

The repository contains the production **public** verification key, public-key verification code and test-only pre-signed fixtures, but **no production private signing key or license-generation capability**. The separate private `thunold-olsen-licensing` repository handles issuance, private keys and commercial backend logic. Its boundary with this repository is the documented signed envelope and verifier contract; it is not a second Fylkren product or code fork. Customers can follow the [connected or air-gapped Enterprise license procedure](../operations/GET_ENTERPRISE_LICENSE.md).

## Brand and participation

The Fylkren name and logo are addressed separately in [TRADEMARKS.md](../../TRADEMARKS.md). Accurate identification of genuine installations and independent consulting, integration, deployment, training and support are welcome under that guidance; third parties must not imply endorsement or ownership.

GitHub Issues may be used for bugs, ideas and discussion once the repository is public. There is no external code-contribution or pull-request program at this stage. Security reports must follow [SECURITY.md](../../SECURITY.md), not public issues.

## Publication gate

Before opening the repository, complete the [publication-readiness review](PUBLICATION_READINESS.md), including legal review of the previous MPL-2.0 history, copyright ownership, third-party attributions, history sanitization, security contact and final Community/Enterprise release tests. Changing today's `LICENSE` does not itself erase earlier commits or settle rights attached to older distributions.
