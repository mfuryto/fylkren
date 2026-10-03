export type Session = {
  authenticated: boolean;
  hasArchiveAccess?: boolean;
  personId?: string;
  username?: string;
  email?: string;
  displayName?: string;
  isPlatformManager: boolean;
  managesSites?: boolean;
  administersSite?: boolean;
  hasOperationalRole?: boolean;
  canExecute?: boolean;
  mustChangePassword?: boolean;
  hasProfileImage?: boolean;
  isDirectoryManaged?: boolean;
  twoFactorEnabled?: boolean;
  canPlan?: boolean;
  canApproveWork?: boolean;
  isTopLevelLeader?: boolean;
};

export type TaskSite = {
  siteId: string;
  name: string;
  overviewDesign?: "classic" | "minimal";
  isSiteManager: boolean;
  hasOperationalAccess?: boolean;
  hasExecutionAccess?: boolean;
  isTopLevelLeader: boolean;
  canCancelWork?: boolean;
  hasTopLevelAccess: boolean;
  isManager: boolean;
  canPlan?: boolean;
};

export type TaskUnit = {
  id: string;
  siteId: string;
  name: string;
  parentId: string | null;
  isSiteLeadership: boolean;
  sortOrder: number;
  assignedToMe: boolean;
  isLeader: boolean;
  receivingSiteId?: string | null;
};
