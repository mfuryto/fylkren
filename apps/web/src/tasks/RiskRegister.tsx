import type { Risk, Mitigation } from "./riskModels";
import { useTranslation } from "../localization/LocalizationProvider";
import type { MessageKey } from "../localization";

const statusKeys: Record<string, MessageKey> = { planned: "mitigationStatusPlanned", in_progress: "mitigationStatusInProgress", completed: "mitigationStatusCompleted", cancelled: "taskStatusCancelled" };
export function RiskRegister({ risks, selectedId, editable, busy, onSelect, onEdit, onAddMitigation, onEditMitigation, onComplete }: {
  risks: Risk[]; selectedId: string | null; editable: boolean; busy: boolean;
  onSelect: (risk: Risk) => void; onEdit: (risk: Risk) => void; onAddMitigation: (risk: Risk) => void; onEditMitigation: (risk: Risk, mitigation: Mitigation) => void; onComplete: (mitigation: Mitigation) => void;
}) {
  const t = useTranslation();
  return <div className="risk-register-scroll"><table className="risk-register"><thead><tr>
    <th>{t("riskNumber")}</th><th>{t("riskTitle")}</th><th>{t("riskDescription")}</th><th>{t("riskBeforeMitigation")}<small>{t("riskCoordinates")}</small></th><th>{t("mitigations")}</th><th>{t("riskDueDate")}</th><th>{t("residualRiskAfterMitigation")}<small>{t("riskCoordinates")}</small></th>{editable && <th aria-label={t("editRisk")} />}
  </tr></thead><tbody>{risks.map((risk, index) => <tr key={risk.id} className={selectedId === risk.id ? "selected" : ""}>
    <td><button className="risk-row-number" type="button" onClick={() => onSelect(risk)} aria-label={`${index + 1}: ${risk.current.title}`} aria-pressed={selectedId === risk.id}>{index + 1}</button></td>
    <td><button className="link-button" type="button" onClick={() => onSelect(risk)}>{risk.current.title}</button></td><td>{risk.current.description}</td>
    <td className={`risk-value risk-${risk.current.level}`}>{risk.current.probability}/{risk.current.impact}</td>
    <td>{risk.mitigations.length === 0 ? <span className="muted">{t("noMitigations")}</span> : risk.mitigations.map(action => <div className="risk-register-action" key={action.id}><span>{action.action}</span><div className="risk-register-action-meta"><small>{action.ownerNameSnapshot} · {statusKeys[action.status] ? t(statusKeys[action.status]) : action.status}</small>{editable && <button className="link-button" disabled={busy} type="button" onClick={() => onEditMitigation(risk, action)}>{t("edit")}</button>}{editable && !["completed", "cancelled"].includes(action.status) && <button className="link-button" disabled={busy} type="button" onClick={() => onComplete(action)}>{t("completeMitigation")}</button>}</div></div>)}{editable && <button className="link-button" disabled={busy} type="button" onClick={() => onAddMitigation(risk)}>+ {t("newMitigation")}</button>}</td>
    <td>{risk.mitigations.map(action => <div className="risk-register-deadline" key={action.id}>{action.dueDate ?? "—"}</div>)}{risk.mitigations.length === 0 && (risk.current.dueDate ?? "—")}</td>
    <td className={`risk-value risk-${risk.current.residualLevel ?? "unknown"}`}>{risk.current.residualProbability !== null && risk.current.residualImpact !== null ? `${risk.current.residualProbability}/${risk.current.residualImpact}` : t("notAssessed")}</td>
    {editable && <td><button className="link-button" disabled={busy} type="button" onClick={() => onEdit(risk)}>{t("editRisk")}</button></td>}
  </tr>)}</tbody></table></div>;
}
