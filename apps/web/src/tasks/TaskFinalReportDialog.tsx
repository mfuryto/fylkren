import { translateActive } from "../localization";
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from "react";
import type { ClassificationMarking } from "../components/ClassificationControls";
import { Modal } from "../components/Modal";
import { RichTextEditor } from "../components/RichText";
import type { WorkItem } from "../work/WorkItemModels";
import { ExecutionHistoryDetails, type ExecutionHistory } from "./ExecutionHistory";

export type FinalReportEditor = { item: WorkItem; content: string; classification: string; executionHistory: ExecutionHistory | null; historyLoading: boolean };

export function TaskFinalReportDialog({ editor, setEditor, childReports, markings, language, busy, onSubmit, renderReport }: { editor: FinalReportEditor; setEditor: Dispatch<SetStateAction<FinalReportEditor | null>>; childReports: WorkItem[]; markings: ClassificationMarking[]; language: string; busy: boolean; onSubmit: (event: FormEvent) => void; renderReport: (item: WorkItem) => ReactNode }) {
  return <Modal title={translateActive("approvalFinalReport")} onClose={() => setEditor(null)}><form className="stacked-form" onSubmit={onSubmit}>
    <p><strong>{editor.item.title}</strong></p>
    {childReports.map(child => <section className="planning-result" key={child.id}><h4>{translateActive("tasksTaskFinalReportDialogReportFrom")} {child.unitName ?? child.title}</h4>{renderReport(child)}</section>)}
    {(editor.historyLoading || editor.executionHistory?.steps.length) && <section className="planning-result"><h3>{translateActive("tasksTaskFinalReportDialogExecutionHistory")}</h3><ExecutionHistoryDetails execution={editor.executionHistory} language={language} loading={editor.historyLoading} loaded={!editor.historyLoading} /></section>}
    <div className="field"><label htmlFor="final-report">{translateActive("tasksTaskFinalReportDialogFinalReportForThisLevel")}</label><RichTextEditor value={editor.content} onChange={content => setEditor({ ...editor, content })} />
      {markings.length > 0 && <div className="field"><label htmlFor="final-report-classification">{translateActive("approvalClassification")}</label><select id="final-report-classification" value={editor.classification} onChange={event => setEditor({ ...editor, classification: event.target.value })}><option value="">{translateActive("tasksTaskFinalReportDialogNoClassification")}</option>{markings.map(marking => <option key={marking.abbreviation} value={marking.abbreviation}>{marking.name} ({marking.abbreviation})</option>)}</select></div>}
    </div>
    <div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setEditor(null)}>{translateActive("cancel")}</button><button className="primary-button" disabled={busy || editor.content.trim().length < 2}>{translateActive("tasksTaskFinalReportDialogSaveFinalReport")}</button></div>
  </form></Modal>;
}
