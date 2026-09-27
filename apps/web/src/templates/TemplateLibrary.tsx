import type { TemplateSummary } from "./TemplateModels";

type TemplateLibraryProps = {
  templates: TemplateSummary[];
  onView: (template: TemplateSummary) => void;
  onEdit: (template: TemplateSummary) => void;
  onRemove: (template: TemplateSummary) => void;
};

export function TemplateLibrary({ templates, onView, onEdit, onRemove }: TemplateLibraryProps) {
  return <section className="panel">
    <h2>Malbibliotek</h2>
    {templates.length === 0 && <p className="muted">Ingen maler er opprettet.</p>}
    <div className="admin-list">
      {templates.map(template => <div className="admin-list-row" key={template.id}>
        <span>
          <strong>{template.name}</strong>
          <small className="muted">{template.ownerUnitName ? `Lokalt nivå · ${template.ownerUnitName}` : "Felles for siten og planlegging"}</small>
        </span>
        <div className="row-actions">
          <button className="link-button" type="button" onClick={() => onView(template)}>Vis</button>
          {template.canEdit && <button className="link-button" type="button" onClick={() => onEdit(template)}>Rediger</button>}
          {template.canEdit && <button className="link-button danger" type="button" onClick={() => onRemove(template)}>Slett</button>}
        </div>
      </div>)}
    </div>
  </section>;
}
