import { useTranslation } from "../localization/LocalizationProvider";
import type { Assessment, Risk, RiskDraft } from "./riskModels";

export function RiskEditor({ draft, risk, busy, saveDisabled = false, assessment, onAssessment, onChange, onSubmit, onCancel, onAddMitigation, onEditMitigation }: {
  draft: RiskDraft; risk: Risk | null; busy: boolean; saveDisabled?: boolean; assessment: Assessment;
  onAssessment: (value: Assessment) => void; onChange: (value: RiskDraft) => void;
  onSubmit: (event: React.FormEvent) => void; onCancel: () => void; onAddMitigation: () => void; onEditMitigation: (id: string) => void;
}) {
  const t = useTranslation();
  return <form className="stacked-form risk-editor" onSubmit={onSubmit}>
    <h3>{risk ? t("editRisk") : t("registerRisk")}</h3>
    <div className="field"><label htmlFor="risk-title">{t("riskTitle")}</label><input disabled={busy} id="risk-title" required minLength={2} maxLength={200} value={draft.title} onChange={event => onChange({ ...draft, title: event.target.value })} /></div>
    <div className="field"><label htmlFor="risk-description">{t("riskDescription")}</label><textarea disabled={busy} id="risk-description" required minLength={2} maxLength={10000} rows={2} value={draft.description} onChange={event => onChange({ ...draft, description: event.target.value })} /></div>
    <fieldset className={`risk-assessment-fields${assessment === "before" ? " selected" : ""}`}><legend><button disabled={busy} type="button" className="link-button" aria-pressed={assessment === "before"} onClick={() => onAssessment("before")}>{t("riskBeforeMitigation")}</button></legend>
      <div className="form-grid">{(["probability", "impact"] as const).map(key => <div className="field" key={key}><label htmlFor={`risk-${key}`}>{t(key === "probability" ? "riskProbability" : "riskImpact")}</label><input disabled={busy} id={`risk-${key}`} type="number" min={1} max={5} step={1} required value={draft[key]} onFocus={() => onAssessment("before")} onChange={event => onChange({ ...draft, [key]: Number(event.target.value) })} /></div>)}</div>
    </fieldset>
    <fieldset className="risk-assessment-fields"><legend>{t("mitigations")}</legend>
      {risk ? <><ul className="risk-editor-actions">{risk.mitigations.map(action => <li key={action.id}>{action.action}{action.dueDate && <small>{action.dueDate}</small>} <button disabled={busy} className="link-button" type="button" onClick={() => onEditMitigation(action.id)}>{t("edit")}</button></li>)}</ul><button disabled={busy} className="link-button" type="button" onClick={onAddMitigation}>+ {t("newMitigation")}</button></> : <div className="field"><label htmlFor="risk-initial-action">{t("mitigationAction")}</label><textarea disabled={busy} id="risk-initial-action" rows={2} minLength={2} maxLength={4000} value={draft.initialMitigation} onChange={event => onChange({ ...draft, initialMitigation: event.target.value })} /></div>}
      {(!risk || risk.mitigations.length === 0) && <div className="field"><label htmlFor="risk-deadline">{t("riskDueDate")}</label><input disabled={busy} id="risk-deadline" type="date" value={draft.dueDate} onChange={event => onChange({ ...draft, dueDate: event.target.value })} /></div>}
    </fieldset>
    <fieldset className={`risk-assessment-fields${assessment === "after" ? " selected" : ""}`}><legend><button disabled={busy} type="button" className="link-button" aria-pressed={assessment === "after"} onClick={() => onAssessment("after")}>{t("residualRiskAfterMitigation")}</button></legend>
      <div className="form-grid">{(["residualProbability", "residualImpact"] as const).map(key => <div className="field" key={key}><label htmlFor={`risk-${key}`}>{t(key)}</label><input disabled={busy} id={`risk-${key}`} type="number" min={1} max={5} step={1} value={draft[key]} onFocus={() => onAssessment("after")} onChange={event => onChange({ ...draft, [key]: event.target.value })} /></div>)}</div>
      <button disabled={busy} type="button" className="link-button" onClick={() => onChange({ ...draft, residualProbability: "", residualImpact: "" })}>{t("notAssessed")}</button>
    </fieldset>
    <div className="field"><label htmlFor="risk-status">{t("riskStatus")}</label><select disabled={busy} id="risk-status" value={draft.status} onChange={event => onChange({ ...draft, status: event.target.value })}>{([ ["identified", "riskStatusIdentified"], ["active", "riskStatusActive"], ["mitigating", "riskStatusMitigating"], ["accepted", "riskStatusAccepted"], ["closed", "riskStatusClosed"] ] as const).map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}</select></div>
    <p className="muted">{t(risk ? "riskEditVersionHelp" : "riskOwnerHelp")}</p>
    <div className="modal-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onCancel}>{t("cancelEditing")}</button><button className="primary-button" disabled={busy || saveDisabled || Boolean(draft.residualProbability) !== Boolean(draft.residualImpact)}>{t(risk ? "saveNewVersion" : "registerRisk")}</button></div>
  </form>;
}
