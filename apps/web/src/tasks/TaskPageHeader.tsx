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
        <h1>Oppgaver</h1>
        <p className="muted">Mottak, vurdering og oppfølging av oppdrag og anmodninger.</p>
      </div>
      <div className="task-actions">
        <button className="help-button" type="button" onClick={onHelpOpen}><i aria-hidden="true">?</i><span>Hjelp</span></button>
        {isSiteManager && <>
          <button className="secondary-button" type="button" onClick={onTypeManagerOpen}>Oppgavetyper</button>
          <button className="secondary-button" type="button" onClick={onSourceTypeManagerOpen}>Kildetyper</button>
          <button className="secondary-button" type="button" onClick={onSenderManagerOpen}>Avsendere</button>
        </>}
        {canCreate && <button className="primary-button" type="button" onClick={onCreate}>Ny oppgave</button>}
      </div>
    </header>
    {helpOpen && <Modal title="Slik arbeider du med oppgaver" onClose={onHelpClose}>
      <div className="process-help">
        <p>Oppgaver viser oppdrag og anmodninger på valgt arbeidsnivå. Neste steg avhenger av status, mottakernivå og fullmaktene dine.</p>
        <ol>
          <li><strong>Les oppdragsgrunnlaget.</strong><span>Kontroller beskrivelse, hoveddokument, metadata og en eventuell anbefaling ved den første ledervurderingen.</span></li>
          <li><strong>Vurder neste steg.</strong><span>Leder eller bemyndiget leder velger planlegging, direkte utførelse, intern fordeling, anmodning, venting eller avvisning og fastsetter prioritet når oppdraget tas.</span></li>
          <li><strong>Følg opp mottakerne.</strong><span>Et nivå som har fordelt videre venter på rapport. Status og tidligere behandling viser fremdriften uten å overta mottakerens arbeid.</span></li>
          <li><strong>Behandle resultatet.</strong><span>Kontroller returnert arbeid og skriv sluttrapport på eget nivå. Rapporten må godkjennes av leder eller bemyndiget leder.</span></li>
          <li><strong>Avslutt eller rapporter videre.</strong><span>Fullføring skjer først når egen sluttrapport er godkjent og alle direkte underoppdrag er ferdig behandlet.</span></li>
        </ol>
        <p className="muted">Hvilke knapper som vises, avhenger av rollen din, arbeidsnivået og oppdragets status.</p>
      </div>
      <div className="modal-actions"><button className="primary-button" type="button" onClick={onHelpClose}>Lukk</button></div>
    </Modal>}
  </>;
}
