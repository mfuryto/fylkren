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

export type PublicConfiguration = {
  version: string;
  edition: "community" | "enterprise";
  communitySiteLimit: number;
  entitlements: string[];
  setupRequired: boolean;
  defaultLanguage: string;
  timeZone: string;
  classificationEnabled: boolean;
  classificationMarkings: ClassificationMarking[];
  authentication: {
    localEnabled: boolean;
    mfaEnabled?: boolean;
    oidcConfigurationEnabled: boolean;
    samlConfigurationEnabled: boolean;
    activeDirectoryConfigurationEnabled: boolean;
    ldapConfigurationEnabled: boolean;
    webAuthnEnabled?: boolean;
  };
};

export type LoginConfiguration = Pick<PublicConfiguration, "setupRequired" | "defaultLanguage" | "timeZone" | "authentication">;
