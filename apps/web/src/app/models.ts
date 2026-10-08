import type { ClassificationMarking } from "../components/ClassificationControls";

export type Branding = {
  productName: string;
  instanceName: string;
  theme: "light" | "dark" | "system";
  primaryColor: string;
  accentColor: string;
  topBarColor: string;
  topBarTextColor: string;
  customCss: string;
  hasLogo: boolean;
};

export type RegionalSettings = {
  defaultLanguage: "en-GB" | "en-US" | "nb-NO" | "sv-SE" | "da-DK" | "fi-FI" | "de-DE" | "fr-FR" | "pl-PL" | "es-ES" | "it-IT" | "uk-UA" | "nl-NL" | "pt-PT" | "cs-CZ" | "ro-RO" | "et-EE" | "lv-LV" | "lt-LT";
  timeZone: string;
  clockFormat: "12-hour" | "24-hour";
  measurementSystem: "metric" | "imperial";
};

export type PublicConfiguration = RegionalSettings & {
  version: string;
  edition: "community" | "enterprise";
  communitySiteLimit: number;
  entitlements: string[];
  setupRequired: boolean;
  classificationEnabled: boolean;
  classificationMarkings: ClassificationMarking[];
  aiEnabled: boolean;
  authentication: {
    localEnabled: boolean;
    mfaEnabled?: boolean;
    mfaRequired?: boolean;
    oidcConfigurationEnabled: boolean;
    samlConfigurationEnabled: boolean;
    activeDirectoryConfigurationEnabled: boolean;
    ldapConfigurationEnabled: boolean;
    ssoAutoRedirectProvider?: "oidc" | "saml" | null;
    webAuthnEnabled?: boolean;
  };
};

export type LoginConfiguration = Pick<PublicConfiguration, "setupRequired" | "defaultLanguage" | "timeZone" | "clockFormat" | "measurementSystem" | "authentication">;
