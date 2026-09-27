import { apiGet, apiMutate } from "../api/client";

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
  apiGet<FederationIdentity>(`${base}/identity`, "Instansidentiteten kunne ikke lastes.");
export const loadFederationRouting = () =>
  apiGet<FederationRouting>(`${base}/routing`, "Status for oppdragsrouting kunne ikke lastes.");
export const setFederationRouting = (enabled: boolean) =>
  apiMutate<FederationRouting>(`${base}/routing`, "PUT", { enabled },
    "Oppdragsrouting kunne ikke endres.");
export const createFederationIdentity = () =>
  apiMutate<FederationIdentity>(`${base}/identity`, "POST", undefined, "Federeringsnøkkelen kunne ikke opprettes.");
export const createFederationKeyRotation = () =>
  apiMutate<FederationKeyRotationStart>(`${base}/identity/rotation`, "POST", undefined,
    "Nøkkelrotasjonen kunne ikke startes.");
export const recoverFederationIdentity = () =>
  apiMutate<FederationIdentity>(`${base}/identity/recover`, "POST", undefined,
    "Federeringsnøkkelen kunne ikke gjenopprettes.");
export const loadFederationPeers = () =>
  apiGet<FederationPeer[]>(`${base}/peers`, "Motpartene kunne ikke lastes.");
export const discoverFederationPeer = (baseUrl: string) =>
  apiMutate<FederationPeerDiscovery>(`${base}/peers/discover`, "POST", { baseUrl },
    "Motpartens signerte identitet kunne ikke hentes.");
export const createFederationPeer = (name: string, discovery: FederationPeerDiscovery) =>
  apiMutate<FederationPeer>(`${base}/peers`, "POST", {
    instanceId: discovery.instanceId, name, baseUrl: discovery.baseUrl,
    fingerprint: discovery.fingerprint,
  }, "Motparten kunne ikke godkjennes.");
export const probeFederationPeer = (id: string) =>
  apiMutate(`${peerPath(id)}/probe`, "POST", undefined, "Prøvekoblingen mislyktes.");
export const discoverFederationPeerRecovery = (id: string) =>
  apiMutate<FederationPeerDiscovery>(`${peerPath(id)}/key-recovery/discover`, "POST", undefined,
    "Motpartens nye signerte identitet kunne ikke hentes.");
export const approveFederationPeerRecovery = (id: string, fingerprint: string) =>
  apiMutate(`${peerPath(id)}/key-recovery`, "POST", { fingerprint },
    "Motpartens nye nøkkel kunne ikke godkjennes.");
export const loadFederationRemoteSites = (id: string) =>
  apiGet<FederationRemoteSite[]>(`${peerPath(id)}/catalog`, "Den fjerne site-oversikten kunne ikke lastes.");
export const syncFederationCatalog = (id: string) =>
  apiMutate(`${peerPath(id)}/catalog/sync`, "POST", undefined, "Site-oversikten kunne ikke synkroniseres.");
export const loadFederationDeliveries = (id: string) =>
  apiGet<FederationDeliveries>(`${peerPath(id)}/deliveries`, "Leveringskøen kunne ikke lastes.");
export const retryFederationDelivery = (id: string, messageId: string) =>
  apiMutate(`${peerPath(id)}/deliveries/${encodeURIComponent(messageId)}/retry`, "POST", undefined,
    "Leveringen kunne ikke legges tilbake i køen.");
