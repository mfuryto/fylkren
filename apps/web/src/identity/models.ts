export type IdentityProvider = { name: string; key: string; enabledRequested: boolean; configurationPresent: boolean; operational: boolean; stableIdentifier: string };
export type IdentityConfiguration = { local: { enabled: boolean; operational: boolean }; providers: IdentityProvider[]; migration: { status: string; principle: string; usernameMatching: string } };
export type GlobalUser = {
  id: string; displayName: string; email: string | null; isActive: boolean; createdAt: string; isCurrentUser: boolean;
  loginIdentities: Array<{ username: string; isActive: boolean; isPlatformManager: boolean; lastSignedInAt: string | null }>;
  externalIdentities: Array<{ provider: string; username: string | null; isActive: boolean }>;
  siteMemberships: Array<{ siteId: string; siteName: string; isActive: boolean; isSiteManager: boolean }>;
};
export type UserSite = { id: string; name: string };
export type FederatedIdentityLink = { id: string; username: string; displayName: string; subjectId: string };
export type DirectoryIdentityLink = {
  id: string; provider: string; displayName: string; directoryUsername: string; subjectId: string;
  accessEnabled: boolean; lifecycleStatus: string; missingCount: number;
  lastCheckedAt: string | null; lastSuccessfulSyncAt: string | null; suspendedAt: string | null;
};
export type DirectoryLifecycleSummary = {
  checked: number; active: number; suspended: number; resumed: number;
  missingPending: number; unavailable: number;
};
export type GlobalUserPage = { items: GlobalUser[]; total: number; page: number; sites: UserSite[] };
