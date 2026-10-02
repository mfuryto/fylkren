import type { TemplateSummary } from "./TemplateModels";
import { useTranslation } from "../localization/LocalizationProvider";
import { useState } from "react";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

type TemplateLibraryProps = {
  templates: TemplateSummary[];
  onView: (template: TemplateSummary) => void;
  onEdit: (template: TemplateSummary) => void;
  onRemove: (template: TemplateSummary) => void;
};

export function TemplateLibrary({ templates, onView, onEdit, onRemove }: TemplateLibraryProps) {
  const t = useTranslation();
  const [sort, setSort] = useState<ListSort>("name-asc");
  const sortedTemplates = sortList(templates, sort, { name: template => template.name });
  return <section className="panel">
    <div className="section-heading"><h2>{t("templateLibrary")}</h2><ListSortControl id="template-sort" value={sort} onChange={setSort} options={["name-asc", "name-desc"]}/></div>
    {templates.length === 0 && <p className="muted">{t("noWorkTemplates")}</p>}
    <div className="admin-list">
      {sortedTemplates.map(template => <div className="admin-list-row" key={template.id}>
        <span>
          <strong>{template.name}</strong>
          <small className="muted">{template.ownerUnitName ? t("localLevelTemplate", { name: template.ownerUnitName }) : t("sharedSitePlanning")}</small>
        </span>
        <div className="row-actions">
          <button className="link-button" type="button" onClick={() => onView(template)}>{t("view")}</button>
          {template.canEdit && <button className="link-button" type="button" onClick={() => onEdit(template)}>{t("edit")}</button>}
          {template.canEdit && <button className="link-button danger" type="button" onClick={() => onRemove(template)}>{t("delete")}</button>}
        </div>
      </div>)}
    </div>
  </section>;
}
