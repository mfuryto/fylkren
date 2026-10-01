import { Modal } from "../components/Modal";

type TaskPageHeaderProps = {
  helpOpen: boolean;
  isSiteManager: boolean;
  canCreate: boolean;
  onHelpOpen: () => void;
  onHelpClose: () => void;
  onTypeManagerOpen: () => void;
  onSourceTypeManagerOpen: () => void;
  onSenderManagerOpen: () => void;
  onCreate: () => void;
};

export function TaskPageHeader({
  helpOpen,
  isSiteManager,
  canCreate,
  onHelpOpen,
  onHelpClose,
  onTypeManagerOpen,
  onSourceTypeManagerOpen,
  onSenderManagerOpen,
  onCreate,
}: TaskPageHeaderProps) {
  return <>
    <header className="page-header">
      <div>
        <h1>Taskr</h1>
        <p className="muted">Receipt, assessment, and follow-up of tasks and requests.</p>
      </div>
      <div className="task-actions">
        <button className="help-button" type="button" onClick={onHelpOpen}><i aria-hidden="true">?</i><span>Hjelp</span></button>
        {isSiteManager && <>
          <button className="secondary-button" type="button" onClick={onTypeManagerOpen}>Tasktyper</button>
          <button className="secondary-button" type="button" onClick={onSourceTypeManagerOpen}>Kildetyper</button>
          <button className="secondary-button" type="button" onClick={onSenderManagerOpen}>Sendere</button>
        </>}
        {canCreate && <button className="primary-button" type="button" onClick={onCreate}>New task</button>}
      </div>
    </header>
    {helpOpen && <Modal title="How to work with tasks" onClose={onHelpClose}>
      <div className="process-help">
        <p>Tasks shows tasks and requests at the selected work level. The next step depends on status, receiving level, and your authority.</p>
        <ol>
          <li><strong>Read the task basis.</strong><span>Review the description, primary document, metadata, and any recommendation during the initial manager assessment.</span></li>
          <li><strong>Assess the next step.</strong><span>A manager or authorized manager selects planning, direct execution, internal allocation, request, hold, or rejection and sets priority when the task is claimed.</span></li>
          <li><strong>Follow up recipients.</strong><span>A level that has routed work onward waits for a report. Status and previous processing show progress without taking over the recipient's work.</span></li>
          <li><strong>Process the result.</strong><span>Review returned work and write the final report at your own level. The report must be approved by a manager or authorized manager.</span></li>
          <li><strong>Complete or report onward.</strong><span>Completion occurs only after your own final report is approved and all direct subtasks have been fully processed.</span></li>
        </ol>
        <p className="muted">The available buttons depend on your role, work level, and task status.</p>
      </div>
      <div className="modal-actions"><button className="primary-button" type="button" onClick={onHelpClose}>Close</button></div>
    </Modal>}
  </>;
}
