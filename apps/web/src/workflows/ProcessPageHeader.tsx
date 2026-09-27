import { Modal } from "../components/Modal";

export type ProcessHelpStep = {
  title: string;
  description: string;
};

type ProcessPageHeaderProps = {
  title: string;
  description: string;
  helpTitle: string;
  helpIntroduction: string;
  helpSteps: ProcessHelpStep[];
  helpOpen: boolean;
  onHelpOpen: () => void;
  onHelpClose: () => void;
};

export function ProcessPageHeader({
  title,
  description,
  helpTitle,
  helpIntroduction,
  helpSteps,
  helpOpen,
  onHelpOpen,
  onHelpClose,
}: ProcessPageHeaderProps) {
  return <>
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <button className="help-button" type="button" onClick={onHelpOpen}>
        <i aria-hidden="true">?</i><span>Hjelp</span>
      </button>
    </header>
    {helpOpen && <Modal title={helpTitle} onClose={onHelpClose}>
      <div className="process-help">
        <p>{helpIntroduction}</p>
        <ol>
          {helpSteps.map(step => <li key={step.title}>
            <strong>{step.title}</strong><span>{step.description}</span>
          </li>)}
        </ol>
      </div>
      <div className="modal-actions">
        <button className="primary-button" type="button" onClick={onHelpClose}>Lukk</button>
      </div>
    </Modal>}
  </>;
}
