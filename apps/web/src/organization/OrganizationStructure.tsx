import type { OrganizationUnitSummary } from "../siteAdmin/models";
import type { OrderedOrganizationUnit } from "./organizationHierarchy";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";

export function OrganizationStructure({
  units,
  orderedUnits,
  canManage,
  onEdit,
  onReorder,
}: {
  units: OrganizationUnitSummary[];
  orderedUnits: OrderedOrganizationUnit[];
  canManage: boolean;
  onEdit: (unit: OrganizationUnitSummary) => void;
  onReorder: (unitId: string, direction: "up" | "down") => void;
}) {
  const t = useTranslation();
  const language = useLanguage();
  return (
    <section className="panel organization-list">
      <div className="section-heading hierarchy-panel-heading">
        <div>
          <h2>{t("organizationStructure")}</h2>
          <p className="muted">{t("organizationStructureIntro")}</p>
        </div>
      </div>
      {units.length === 0 ? (
        <p className="empty-list">{t("noOrganizationUnits")}</p>
      ) : (
        orderedUnits.map(({ unit, depth }) => {
          const siblings = units
            .filter((candidate) => candidate.parentId === unit.parentId)
            .sort(
              (a, b) =>
                a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, language),
            );
          const siblingIndex = siblings.findIndex((candidate) => candidate.id === unit.id);
          return (
            <article className="organization-row" key={unit.id}>
              <strong style={{ paddingLeft: `${depth * 24}px` }}>
                {depth ? "↳ " : ""}
                {unit.name}
              </strong>
              <span className="muted">
                {unit.isChildSite
                  ? t("childSite")
                  : unit.isSiteLeadership
                    ? t("siteLeadership")
                    : unit.parentId
                      ? t("underUnit", { name: units.find((parent) => parent.id === unit.parentId)?.name ?? t("unknownUnit") })
                      : t("topLevel")}
              </span>
              <span className={unit.isActive ? "status-active" : "muted"}>
                {unit.isChildSite
                  ? t("site")
                  : unit.isTemporary
                    ? t("temporary")
                    : unit.isActive
                      ? t("active")
                      : t("deactivated")}
              </span>
              {canManage && !unit.isChildSite && (
                <div className="row-actions">
                  <button
                    className="icon-button compact"
                    type="button"
                    disabled={siblingIndex === 0}
                    aria-label={t("moveUnitUp", { name: unit.name })}
                    title={t("moveUp")}
                    onClick={() => onReorder(unit.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-button compact"
                    type="button"
                    disabled={siblingIndex === siblings.length - 1}
                    aria-label={t("moveUnitDown", { name: unit.name })}
                    title={t("moveDown")}
                    onClick={() => onReorder(unit.id, "down")}
                  >
                    ↓
                  </button>
                  <button className="link-button" type="button" onClick={() => onEdit(unit)}>
                    {t("edit")}
                  </button>
                </div>
              )}
            </article>
          );
        })
      )}
    </section>
  );
}
