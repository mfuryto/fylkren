# Security policy

Security is part of Fylkren's product boundary. The maintained assurance material
includes an [OWASP ASVS 5.0 Level 2 matrix](dev-notes/security/ASVS_5.0.0_L2_MATRIX.md),
[threat model](dev-notes/security/SECURITY_THREAT_MODEL.md),
[security test plan](dev-notes/security/SECURITY_TEST_PLAN.md) and
[verification record](dev-notes/security/SECURITY_VERIFICATION.md).

## Supported versions

Security corrections are provided for the latest stable release. Operators
should upgrade to the latest patch version before requesting support for an
older installation. Release notes identify any different support or migration
requirements.

| Version | Security support |
| --- | --- |
| Latest stable release | Supported |
| Older releases and prereleases | Upgrade required |

## Report a vulnerability privately

Do **not** disclose a suspected vulnerability in a public issue, discussion,
pull request or support request. Use Fylkren's
[private vulnerability reporting form](https://github.com/mfuryto/fylkren/security/advisories/new).
GitHub Security Advisories keep the report and coordinated remediation private
until an agreed disclosure.

Include only the information needed to reproduce and assess the issue:

- affected Fylkren version and deployment type;
- affected component, endpoint or workflow;
- impact and the access level required;
- safe reproduction steps or a minimal proof of concept;
- relevant correlation IDs and sanitized logs; and
- known mitigations or workarounds.

Never include live credentials, customer data, personal data, private keys,
production addresses or operational backups. If sensitive evidence is necessary,
first ask in the private report how it should be transferred.

Maintainers aim to acknowledge a complete report within three business days,
assess severity and affected versions, coordinate remediation and agree on a
disclosure date. Response time depends on impact and reproducibility. Publishing
an advisory or requesting a CVE happens after a correction and operator guidance
are ready, unless active exploitation requires a different response.

## Scope and safe research

Reports about authorization, authentication, cryptography, federation,
integrations, file handling, information lifecycle, privacy or cross-Site data
access are in scope when they affect Fylkren code or its documented deployment.
Vulnerabilities in an upstream dependency are also useful when the report shows
that a supported Fylkren release is affected.

Security testing must use an installation you own or have explicit permission to
test. Do not access other people's data, degrade shared services, use social
engineering, publish secrets or retain data obtained during research.

Deployment-specific weaknesses in an operator's network, identity provider,
reverse proxy or host should be reported to that operator. If Fylkren's defaults
or documentation contributed to the weakness, report that product impact
privately as well.
