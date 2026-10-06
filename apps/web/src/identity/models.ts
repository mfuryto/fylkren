export type IdentityProvider = { name: string; key: string; enabledRequested: boolean; configurationPresent: boolean; operational: boolean; stableIdentifier: string; lastTestedAt: string | null; lastTestSucceeded: boolean | null };
export type IdentityConfiguration = { local: { enabled: boolean; operational: boolean }; providers: IdentityProvider[]; migration: { status: string; principle: string; usernameMatching: string } };
export type GlobalUser = {
  id: string; displayName: string; email: string | null; isActive: boolean; createdAt: string; isCurrentUser: boolean; accessPending: boolean;
  loginIdentities: Array<{ username: string; isActive: boolean; isPlatformManager: boolean; lastSignedInAt: string | null }>;
  externalIdentities: Array<{ provider: string; username: string | null; isActive: boolean; providerManaged: boolean }>;
  siteMemberships: Array<{ siteId: string; siteName: string; isActive: boolean; isSiteManager: boolean }>;
};
export type UserSite = { id: string; name: string };
export type FederatedIdentityLink = { id: string; username: string; displayName: string; subjectId: string; providerInstanceId: string };
export type ExternalIdentityProvisioningIssue = {
  id: string; provider: string; providerInstanceId: string; subjectId: string; username: string | null;
  displayName: string | null; email: string | null; reason: string; firstSeenAt: string; lastSeenAt: string;
};
export type DirectoryIdentityLink = {
  id: string; provider: string; displayName: string; directoryUsername: string; subjectId: string;
  accessEnabled: boolean; lifecycleStatus: string; missingCount: number;
  lastCheckedAt: string | null; lastSuccessfulSyncAt: string | null; suspendedAt: string | null;
};
export type DirectoryLifecycleSummary = {
  checked: number; active: number; suspended: number; resumed: number;
  missingPending: number; unavailable: number;
};
export type IdentityProviderConfiguration = {
  server: string | null; port: number; security: "ldaps" | "starttls"; baseDn: string | null;
  userSearchBase: string | null; bindDn: string | null; secret?: string | null; domain: string | null;
  usernameAttribute: string; displayNameAttribute: string; emailAttribute: string; stableIdAttribute: string;
  lifecycleActiveFilter: string; authority: string | null; clientId: string | null; callbackPath: string;
  metadataUrl: string | null; entityId: string | null; identityProviderEntityId: string | null; modulePath: string;
  ssoAutoRedirectProvider: string | null; automaticProvisioning: boolean;
};
export type IdentityProviderSettings = {
  provider: string; enabled: boolean; configuration: IdentityProviderConfiguration; hasSecret: boolean;
  updatedAt: string; lastTestedAt: string | null; lastTestSucceeded: boolean | null; lastTestError: string | null;
};
export type GlobalUserPage = { items: GlobalUser[]; total: number; page: number; sites: UserSite[] };
