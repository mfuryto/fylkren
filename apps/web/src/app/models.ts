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
  defaultLanguage: "en" | "nb-NO";
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
  authentication: {
    localEnabled: boolean;
    mfaEnabled?: boolean;
    oidcConfigurationEnabled: boolean;
    samlConfigurationEnabled: boolean;
    activeDirectoryConfigurationEnabled: boolean;
    ldapConfigurationEnabled: boolean;
    ssoAutoRedirectProvider?: "oidc" | "saml" | null;
    webAuthnEnabled?: boolean;
  };
};

export type LoginConfiguration = Pick<PublicConfiguration, "setupRequired" | "defaultLanguage" | "timeZone" | "clockFormat" | "measurementSystem" | "authentication">;
