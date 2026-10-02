import { useState, type ReactNode } from "react";
import type { MessageKey } from "../localization";
import { useTranslation } from "../localization/LocalizationProvider";
import { Modal } from "./Modal";

export function PageHelpButton({ title, paragraphs, children }: { title: MessageKey; paragraphs: MessageKey[]; children?: ReactNode }) {
  const t = useTranslation();
  const [open, setOpen] = useState(false);
  return <>
    <button className="help-button" type="button" aria-haspopup="dialog" onClick={() => setOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button>
    {open && <Modal title={t(title)} onClose={() => setOpen(false)}>
      <div className="process-help">{paragraphs.map(key => <p key={key}>{t(key)}</p>)}{children}</div>
      <div className="modal-actions"><button className="primary-button" type="button" onClick={() => setOpen(false)}>{t("close")}</button></div>
    </Modal>}
  </>;
}
