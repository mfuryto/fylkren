# Linguistic review status

This is the single maintained status reference for Fylkren interface-language review. Technical catalog completeness is necessary but is not linguistic approval. The machine-readable status and catalog hashes are in `LINGUISTIC_REVIEW.json` beside this document.

American English (`en-US`) is the authoritative semantic source. Derived locales are reviewed in the recorded order. One locale is completed before work starts on the next.

A derived locale may be marked `verified` only when all source keys have been reviewed against:

1. the English source sentence, placeholders and screen/workflow context;
2. the Fylkren term base and reserved product terms;
3. the locale's maintained technical terminology and style guidance;
4. destructive, security, identity, entitlement, workflow, decision, risk and audit meanings;
5. grammar, idiom, consistency, punctuation and address form across the complete catalog;
6. catalog parity, protected-token, placeholder, layout and application tests.

The review record binds approval to the complete English-source hash and locale-catalog hash. Any later change invalidates that approval until the affected locale is reviewed again. Automated translation or a passing structural test cannot by itself produce `verified` status.

Current audit work began after a full-catalog sample found material semantic errors in several derived locales. Until the recorded review is complete, documentation must describe those catalogs as technically complete with linguistic review pending.
