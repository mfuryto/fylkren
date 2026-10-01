import { translateActive } from "../localization";
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../api/client";
import { Modal } from "../components/Modal";
import type { WorkItem } from "../work/WorkItemModels";
import { ApprovalVersionDocument } from "./ApprovalVersionDocument";

type ApprovalVersion = {
  id: string;
  objectType: string;
  objectId: string;
  versionNumber: number;
  title: string;
  approvalStatus: string;
  createdAt: string;
  contentHash: string;
  content: unknown;
  signoffs: Array<{ id: string; approver: string; status: string; signedAt: string; comment: string | null }>;
};

const objectName = (objectType: string) => ({
  plan: translateActive("planLabel"),
  final_report: translateActive("approvalFinalReport"),
  decision: translateActive("approvalDecision"),
} as Record<string, string>)[objectType] ?? objectType;

export function TaskVersionDialog({ siteId, item, language, timeZone, onClose, onError }: { siteId: string; item: WorkItem; language: string; timeZone: string; onClose: () => void; onError: (message: string) => void }) {
  const [versions, setVersions] = useState<ApprovalVersion[]>([]);
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    apiGet<ApprovalVersion[]>(`/api/approvals/sites/${siteId}/items/${item.id}/versions`, translateActive("tasksTaskVersionDialogVersionHistoryCouldNotBeLoaded"))
      .then(values => { setVersions(values); setRightId(values[0]?.id ?? ""); setLeftId(values.find(value => value.id !== values[0]?.id && value.objectType === values[0]?.objectType && value.objectId === values[0]?.objectId)?.id ?? values[0]?.id ?? ""); })
      .catch(problem => onError(problem instanceof Error ? problem.message : translateActive("tasksTaskVersionDialogVersionHistoryCouldNotBeLoaded")))
      .finally(() => setLoading(false));
  }, [siteId, item.id]);
  const left = useMemo(() => versions.find(x => x.id === leftId), [versions, leftId]);
  const right = useMemo(() => versions.find(x => x.id === rightId), [versions, rightId]);
  const label = (value: ApprovalVersion) => translateActive("versionLabel", { type: objectName(value.objectType), number: value.versionNumber });
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(new Date(value));
  return <Modal title={translateActive("approvedVersionsTitle", { title: item.title })} onClose={onClose}>
    {loading ? <p className="status-message">{translateActive("tasksTaskVersionDialogLoadingVersionHistory")}</p> : versions.length === 0 ? <p className="empty-state">{translateActive("tasksTaskVersionDialogThereAreNoFormallyApprovedVersions")}</p> : <div className="approval-version-viewer">
      <div className="approval-version-list">{versions.map(version => <article className="approval-version-row" key={version.id}><div><strong>{label(version)}</strong><span>{version.title}</span><small>{translateActive("tasksTaskVersionDialogApproved")} {date(version.createdAt)} {translateActive("tasksTaskVersionDialogChecksum")} {version.contentHash.slice(0, 12)}</small></div><div>{version.signoffs.map(signoff => <span className="approval-signoff" key={signoff.id}>✓ {signoff.approver} · {date(signoff.signedAt)}</span>)}</div></article>)}</div>
      <section className="approval-comparison"><div className="section-heading"><div><h3>{translateActive("tasksTaskVersionDialogCompareVersions")}</h3><p className="muted">{translateActive("tasksTaskVersionDialogContentIsShownAsReadableFields")}</p></div></div>
        <div className="approval-compare-selectors"><div className="field"><label htmlFor="approval-left">{translateActive("tasksTaskClassifiersFrom")}</label><select id="approval-left" value={leftId} onChange={event => setLeftId(event.target.value)}>{versions.map(version => <option value={version.id} key={version.id}>{label(version)}</option>)}</select></div><div className="field"><label htmlFor="approval-right">{translateActive("tasksTaskVersionDialogTo")}</label><select id="approval-right" value={rightId} onChange={event => setRightId(event.target.value)}>{versions.map(version => <option value={version.id} key={version.id}>{label(version)}</option>)}</select></div></div>
        <div className="approval-compare-grid"><ApprovalVersionDocument version={left} compareWith={left?.objectId === right?.objectId && left?.objectType === right?.objectType ? right : undefined} language={language} timeZone={timeZone} /><ApprovalVersionDocument version={right} compareWith={left?.objectId === right?.objectId && left?.objectType === right?.objectType ? left : undefined} language={language} timeZone={timeZone} /></div>
      </section>
    </div>}
  </Modal>;
}
