export type PersonSummary = { id: string; displayName: string; email?: string | null };

export type SiteSummary = {
  id: string;
  parentOrganizationUnitId: string | null;
  name: string;
  isActive: boolean;
  overviewDesign: "classic" | "minimal";
  siteManagers: PersonSummary[];
};

export type PlacementOption = { id: string; siteId: string; siteName: string; unitName: string; isSiteRoot: boolean };

export type OrganizationUnitSummary = {
  id: string;
  parentId: string | null;
  name: string;
  isTemporary: boolean;
  worksAtParentLevel: boolean;
  isSiteLeadership: boolean;
  isActive: boolean;
  sortOrder: number;
  isChildSite?: boolean;
  linkedSiteId?: string | null;
};

export type RoleAssignmentSummary = {
  id: string;
  personId: string;
  displayName: string;
  validFrom: string;
  validTo: string | null;
  canLeadParentLevel: boolean;
};

export type RoleSummary = {
  id: string;
  organizationUnitId: string;
  organizationUnitName: string;
  name: string;
  isLeader: boolean;
  hasLeaderAccess: boolean;
  canPlan: boolean;
  assignments: RoleAssignmentSummary[];
};

export type MemberSummary = PersonSummary & {
  email?: string | null;
  username?: string;
  directoryProvider?: string | null;
  isActive: boolean;
  organizationUnitId: string | null;
  organizationUnitName: string | null;
};

export type AccessSummary = { members: MemberSummary[]; roles: RoleSummary[] };

export type DirectoryProviderSummary = { key: string; name: string };
export type DirectoryUserSummary = { provider: string; stableId: string; username: string; displayName?: string | null; email?: string | null };
export type ExistingUserSummary = { id: string; displayName: string; email?: string | null; username: string; sites: string[] };
