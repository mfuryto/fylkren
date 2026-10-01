import { translateActive } from "../localization";
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
        <h1>{translateActive("navTasks")}</h1>
        <p className="muted">{translateActive("tasksTaskPageHeaderReceiptAssessmentAndFollowUpOf")}</p>
      </div>
      <div className="task-actions">
        <button className="help-button" type="button" onClick={onHelpOpen}><i aria-hidden="true">?</i><span>{translateActive("help")}</span></button>
        {isSiteManager && <>
          <button className="secondary-button" type="button" onClick={onTypeManagerOpen}>{translateActive("tasksTaskLookupDialogsTaskTypes")}</button>
          <button className="secondary-button" type="button" onClick={onSourceTypeManagerOpen}>{translateActive("tasksTaskLookupDialogsSourceTypes")}</button>
          <button className="secondary-button" type="button" onClick={onSenderManagerOpen}>{translateActive("tasksTaskLookupDialogsSenders")}</button>
        </>}
        {canCreate && <button className="primary-button" type="button" onClick={onCreate}>{translateActive("templateNewWork")}</button>}
      </div>
    </header>
    {helpOpen && <Modal title={translateActive("tasksTaskPageHeaderHowToWorkWithTasks")} onClose={onHelpClose}>
      <div className="process-help">
        <p>{translateActive("tasksTaskPageHeaderTasksShowsTasksAndRequestsAt")}</p>
        <ol>
          <li><strong>{translateActive("tasksTaskPageHeaderReadTheTaskBasis")}</strong><span>{translateActive("tasksTaskPageHeaderReviewTheDescriptionPrimaryDocumentMetadata")}</span></li>
          <li><strong>{translateActive("tasksTaskPageHeaderAssessTheNextStep")}</strong><span>{translateActive("tasksTaskPageHeaderAManagerOrAuthorizedManagerSelects")}</span></li>
          <li><strong>{translateActive("tasksTaskPageHeaderFollowUpRecipients")}</strong><span>{translateActive("tasksTaskPageHeaderALevelThatHasRoutedWork")}</span></li>
          <li><strong>{translateActive("tasksTaskPageHeaderProcessTheResult")}</strong><span>{translateActive("tasksTaskPageHeaderReviewReturnedWorkAndWriteThe")}</span></li>
          <li><strong>{translateActive("tasksTaskPageHeaderCompleteOrReportOnward")}</strong><span>{translateActive("tasksTaskPageHeaderCompletionOccursOnlyAfterYourOwn")}</span></li>
        </ol>
        <p className="muted">{translateActive("tasksTaskPageHeaderTheAvailableButtonsDependOnYour")}</p>
      </div>
      <div className="modal-actions"><button className="primary-button" type="button" onClick={onHelpClose}>{translateActive("close")}</button></div>
    </Modal>}
  </>;
}
