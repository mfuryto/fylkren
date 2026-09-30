import { Modal } from "./Modal";
import { useTranslation } from "../localization/LocalizationProvider";

type HelpStep = {
  title: string;
  text: string;
};

type SectionHelpProps = {
  title: string;
  intro: string;
  steps: HelpStep[];
  note?: string;
  onClose: () => void;
};

export function SectionHelp({ title, intro, steps, note, onClose }: SectionHelpProps) {
  const t = useTranslation();
  return (
    <Modal title={title} onClose={onClose}>
      <div className="process-help">
        <p>{intro}</p>
        <ol>
          {steps.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
        {note && <p className="muted">{note}</p>}
      </div>
      <div className="modal-actions">
        <button className="primary-button" type="button" onClick={onClose}>{t("close")}</button>
      </div>
    </Modal>
  );
}
