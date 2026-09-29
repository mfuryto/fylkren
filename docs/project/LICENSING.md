# Licensing and editions

## Source-available software license

The current project-authored Fylkren source and documentation are made available under the unmodified [PolyForm Perimeter 1.0.0 license](../../LICENSE), unless a file says otherwise. Fylkren is **source-available**, not open source. The exact applicable terms are in `LICENSE`; this page is an orientation, not a substitute for those terms. [NOTICE.md](../../NOTICE.md) identifies THUNOLD-OLSEN (Norwegian organization number 996871126) as the copyright holder. Third-party material keeps its own terms; see [third-party notices](THIRD_PARTY_NOTICES.md).

The license text contains an illustrative `Required Notice` example; that example is part of the official unmodified text, **not** Fylkren's copyright notice. The actual Fylkren notice is in `NOTICE.md`.

## Recorded scope review

The current license does **not** implement a general prohibition on copying or
redistribution. Its Distribution License expressly permits distribution of the
software, including permitted changes and new works, provided that the license
conditions and notices are followed. Its Noncompete restriction instead makes
use impermissible when the purpose is to provide others with a product that
competes with Fylkren. These are different boundaries: redistribution is not
automatically competitive use.

PolyForm Perimeter also contains no Fylkren-specific promise to buy an
Enterprise entitlement and no express Fylkren-specific restriction on changing
a privately controlled copy to bypass runtime entitlement checks. The signed
license protects an **unaltered official build**; it does not add contractual
restrictions to the source license. The trademark policy can prevent misleading
branding, but it does not replace software or customer-license terms.

Consequently, the present documents are suitable only if THUNOLD-OLSEN accepts
the redistribution rights actually granted by PolyForm Perimeter. If the
commercial requirement is instead to prohibit unauthorized redistribution or
contractually prohibit circumvention of Enterprise controls, the present source
license is insufficient on its own. That requirement must be resolved before
public release by qualified counsel through an approved source-license strategy
and separate customer/commercial terms. Do not add local clauses to the
unmodified PolyForm text or describe runtime enforcement as if it supplied the
missing legal terms.

The pre-publication legal decision must record, at minimum:

- whether public GitHub viewing and forking plus PolyForm distribution rights
  are accepted, or whether a different source license is required;
- which copying, redistribution, hosting, modification and competitive uses are
  permitted or prohibited;
- the contractual scope, term, installation count and transfer rules for an
  Enterprise entitlement;
- treatment of entitlement bypass, modified builds and use after expiry,
  subject to mandatory rights that cannot lawfully be excluded;
- termination, cure, renewal, support, update and enforcement terms;
- ownership of contributions and the effect of the earlier MPL-2.0 history;
- separation of project-authored terms from third-party licenses; and
- consistency between the repository license, customer agreement, order flow,
  website statements, trademark policy and signed license payload.

This is a requirements record, not drafted legal terms or legal approval.

## Software license versus feature entitlement

Community and Enterprise share one repository, codebase, set of API/web images, database schema and upgrade path. A customer can run Community offline without a license file. A valid signed offline Enterprise license activates only the entitlements specified for that installation. Runtime entitlement checks and the software license are separate; neither a UI control nor an Enterprise label changes the terms of `LICENSE`. See the [edition architecture](../architecture/EDITION_ENTITLEMENTS.md) for the centralized allocation and safe downgrade behavior.

The repository contains the production **public** verification key, public-key verification code and test-only pre-signed fixtures, but **no production private signing key or license-generation capability**. The separate private `thunold-olsen-licensing` repository handles issuance, private keys and commercial backend logic. Its boundary with this repository is the documented signed envelope and verifier contract; it is not a second Fylkren product or code fork. Customers can follow the [connected or air-gapped Enterprise license procedure](../operations/GET_ENTERPRISE_LICENSE.md).

## Brand and participation

The Fylkren name and logo are addressed separately in [TRADEMARKS.md](../../TRADEMARKS.md). Accurate identification of genuine installations and independent consulting, integration, deployment, training and support are welcome under that guidance; third parties must not imply endorsement or ownership.

GitHub Issues may be used for bugs, ideas and discussion once the repository is public. There is no external code-contribution or pull-request program at this stage. Security reports must follow [SECURITY.md](../../SECURITY.md), not public issues.

## Publication gate

Before opening the repository, complete the [publication-readiness review](PUBLICATION_READINESS.md), including the recorded source-license and customer-terms decision above, legal review of the previous MPL-2.0 history, copyright ownership, third-party attributions, history sanitization, security contact and final Community/Enterprise release tests. Changing today's `LICENSE` does not itself erase earlier commits or settle rights attached to older distributions.
