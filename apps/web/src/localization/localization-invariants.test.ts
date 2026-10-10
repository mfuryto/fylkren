import { describe, expect, it } from "vitest";
import { languageCatalogs, supportedLanguages } from ".";
import { en } from "./catalogs/en-US";

describe("localization catalog invariants", () => {
  it("rejects translation-tool artifacts and control characters", () => {
    const artifact = /NAME OF TRANSLATORS|@\s*info|whatsthis|STARTLS|TIRPIK|\bNPI\b|Nelegalus|Toksiškumas|Locale locale|Nessun segnale locale|(?:\.\s*){8,}|(?:•\s*){12,}|[\u0000-\u0008\u000B\u000C\u000E-\u001F]/i;
    for (const language of supportedLanguages) {
      for (const message of Object.values(languageCatalogs[language])) expect(message).not.toMatch(artifact);
    }
  });

  it("does not silently retain substantial English interface text", () => {
    const allowedIdenticalMessages = new Set([
      "fylkrenSpEntityId",
      "languagePortuguese",
      "oidcSubject",
      "revision",
      "underSiteUnit",
      "versionLabel",
      "workflowsWorkflowFieldsHttpsFileOrSmb",
    ]);
    for (const language of supportedLanguages.filter(language => !["en-US", "en-GB"].includes(language))) {
      for (const [key, message] of Object.entries(languageCatalogs[language])) {
        if (message.length >= 18 && message === en[key as keyof typeof en]) {
          expect(allowedIdenticalMessages, `${language}.${key} is still English`).toContain(key);
        }
      }
    }
  });

  it("preserves protocol names, API paths, headers and permission scopes", () => {
    const protectedTokens = [
      "/api/v1/administration/sites",
      "classifications:read",
      "classifications:write",
      "Idempotency-Key",
      "If-Match",
      "reports:read",
      "STARTTLS",
      "WebAuthn",
      "HTTPS",
      "SMTP",
      "SAML",
      "OIDC",
      "LDAP",
      "SCIM",
      "ETag",
      "UTC",
      "API",
    ];
    for (const language of supportedLanguages) {
      for (const [key, source] of Object.entries(en)) {
        for (const token of protectedTokens.filter(candidate => source.includes(candidate))) {
          expect(languageCatalogs[language][key as keyof typeof en], `${language}.${key} must preserve ${token}`).toContain(token);
        }
      }
    }
  });

  it("keeps Site terminology invariant in every translated interface sentence", () => {
    const withoutTechnicalSegments = (message: string) => message
      .replace(/\{[A-Za-z][A-Za-z0-9]*\}/g, "")
      .replace(/\/[^\s,.;)]+/g, "")
      .replace(/\bSite Managers?\b/g, "");

    for (const language of supportedLanguages) {
      for (const [key, sourceMessage] of Object.entries(en)) {
        const source = withoutTechnicalSegments(sourceMessage);
        const translated = withoutTechnicalSegments(languageCatalogs[language][key as keyof typeof en]);
        if (/\bsites\b/i.test(source)) expect(translated, `${language}.${key} must use Sites`).toMatch(/\bSites\b/);
        else if (/\bsite(?:'s)?\b/i.test(source)) expect(translated, `${language}.${key} must use Site`).toMatch(/\bSite\b/);
      }
    }
  });
});
