import type { OrganizationUnitSummary } from "../siteAdmin/models";
import type { OrderedOrganizationUnit } from "./organizationHierarchy";

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
  return (
    <section className="panel organization-list">
      <div className="section-heading hierarchy-panel-heading">
        <div>
          <h2>Struktur</h2>
          <p className="muted">Enheter vises i organisatorisk rekkefølge.</p>
        </div>
      </div>
      {units.length === 0 ? (
        <p className="empty-list">Ingen organisasjonsenheter er opprettet.</p>
      ) : (
        orderedUnits.map(({ unit, depth }) => {
          const siblings = units
            .filter((candidate) => candidate.parentId === unit.parentId)
            .sort(
              (a, b) =>
                a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"),
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
                  ? "Child-site"
                  : unit.isSiteLeadership
                    ? "Sitens toppledelse"
                    : unit.parentId
                      ? `Under ${units.find((parent) => parent.id === unit.parentId)?.name ?? "ukjent"}`
                      : "Toppnivå"}
              </span>
              <span className={unit.isActive ? "status-active" : "muted"}>
                {unit.isChildSite
                  ? "Site"
                  : unit.isTemporary
                    ? "Midlertidig"
                    : unit.isActive
                      ? "Aktiv"
                      : "Deaktivert"}
              </span>
              {canManage && !unit.isChildSite && (
                <div className="row-actions">
                  <button
                    className="icon-button compact"
                    type="button"
                    disabled={siblingIndex === 0}
                    aria-label={`Flytt ${unit.name} opp`}
                    title="Flytt opp"
                    onClick={() => onReorder(unit.id, "up")}
                  >
                    ↑
                  </button>
                  <button
                    className="icon-button compact"
                    type="button"
                    disabled={siblingIndex === siblings.length - 1}
                    aria-label={`Flytt ${unit.name} ned`}
                    title="Flytt ned"
                    onClick={() => onReorder(unit.id, "down")}
                  >
                    ↓
                  </button>
                  <button className="link-button" type="button" onClick={() => onEdit(unit)}>
                    Rediger
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
