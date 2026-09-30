import { apiGet, apiMutate } from "../api/client";
import { translateActive } from "../localization";

export type FederationIdentity = {
  instanceId: string;
  keyConfigured: boolean;
  keyUsable?: boolean;
  publicKeySpki?: string;
  fingerprint?: string;
  keyRotationPending?: boolean;
  pendingRotationId?: string | null;
  pendingCreatedAt?: string | null;
  activeRotationId?: string | null;
  rotationActivatedAt?: string | null;
};

export type FederationKeyRotationStart = {
  instanceId: string;
  rotationId: string;
  status: "distributing";
  automatic: true;
};

export type FederationPeer = {
  instanceId: string;
  name: string;
  baseUrl: string;
  isActive: boolean;
  pinnedPublicKeySpki: string | null;
  fingerprint: string | null;
  lastProofAt: string | null;
  keyRotationPending: boolean;
  pendingKeyRotationId: string | null;
  keyRotationStagedAt: string | null;
  routable: false;
};

export type FederationPeerDiscovery = {
  instanceId: string;
  baseUrl: string;
  fingerprint: string;
  verifiedAt: string;
};

export type FederationRemoteSite = {
  siteId: string;
  name: string;
  isActive: boolean;
  catalogRevision: number;
};

export type FederationRouting = {
  enabled: boolean;
  readyToEnable: boolean;
  blockers: string[];
  changedAt: string;
  changedBy: string | null;
};

export type FederationDelivery = {
  messageId: string;
  messageType: string;
  status: "pending" | "retrying" | "delivered" | "failed";
  attemptCount: number;
  createdAt: string;
  nextAttemptAt: string;
  deliveredAt: string | null;
  lastErrorCode: string | null;
};

export type FederationDeliveries = {
  pending: number;
  retrying: number;
  delivered: number;
  failed: number;
  items: FederationDelivery[];
};

const base = "/api/platform/federation";
const peerPath = (id: string) => `${base}/peers/${encodeURIComponent(id)}`;

export const loadFederationIdentity = () =>
  apiGet<FederationIdentity>(`${base}/identity`, translateActive("federationIdentityLoadFailed"));
export const loadFederationRouting = () =>
  apiGet<FederationRouting>(`${base}/routing`, translateActive("federationRoutingLoadFailed"));
export const setFederationRouting = (enabled: boolean) =>
  apiMutate<FederationRouting>(`${base}/routing`, "PUT", { enabled },
    translateActive("federationRoutingChangeFailed"));
export const createFederationIdentity = () =>
  apiMutate<FederationIdentity>(`${base}/identity`, "POST", undefined, translateActive("federationIdentityCreateFailed"));
export const createFederationKeyRotation = () =>
  apiMutate<FederationKeyRotationStart>(`${base}/identity/rotation`, "POST", undefined,
    translateActive("federationRotationStartFailed"));
export const recoverFederationIdentity = () =>
  apiMutate<FederationIdentity>(`${base}/identity/recover`, "POST", undefined,
    translateActive("federationIdentityRecoverFailed"));
export const loadFederationPeers = () =>
  apiGet<FederationPeer[]>(`${base}/peers`, translateActive("federationPeersLoadFailed"));
export const discoverFederationPeer = (baseUrl: string) =>
  apiMutate<FederationPeerDiscovery>(`${base}/peers/discover`, "POST", { baseUrl },
    translateActive("federationSignedIdentityLoadFailed"));
export const createFederationPeer = (name: string, discovery: FederationPeerDiscovery) =>
  apiMutate<FederationPeer>(`${base}/peers`, "POST", {
    instanceId: discovery.instanceId, name, baseUrl: discovery.baseUrl,
    fingerprint: discovery.fingerprint,
  }, translateActive("federationPeerApproveFailed"));
export const probeFederationPeer = (id: string) =>
  apiMutate(`${peerPath(id)}/probe`, "POST", undefined, translateActive("federationProbeFailed"));
export const discoverFederationPeerRecovery = (id: string) =>
  apiMutate<FederationPeerDiscovery>(`${peerPath(id)}/key-recovery/discover`, "POST", undefined,
    translateActive("federationRecoveryIdentityLoadFailed"));
export const approveFederationPeerRecovery = (id: string, fingerprint: string) =>
  apiMutate(`${peerPath(id)}/key-recovery`, "POST", { fingerprint },
    translateActive("federationRecoveryApproveFailed"));
export const loadFederationRemoteSites = (id: string) =>
  apiGet<FederationRemoteSite[]>(`${peerPath(id)}/catalog`, translateActive("federationRemoteCatalogueLoadFailed"));
export const syncFederationCatalog = (id: string) =>
  apiMutate(`${peerPath(id)}/catalog/sync`, "POST", undefined, translateActive("federationCatalogueSyncFailed"));
export const loadFederationDeliveries = (id: string) =>
  apiGet<FederationDeliveries>(`${peerPath(id)}/deliveries`, translateActive("federationDeliveriesLoadFailed"));
export const retryFederationDelivery = (id: string, messageId: string) =>
  apiMutate(`${peerPath(id)}/deliveries/${encodeURIComponent(messageId)}/retry`, "POST", undefined,
    translateActive("federationDeliveryRetryFailed"));
