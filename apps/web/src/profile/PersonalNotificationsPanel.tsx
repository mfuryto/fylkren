import { useEffect, useState } from "react";
import {
  loadPersonalNotificationSettings,
  savePersonalNotificationSettings,
  type NotificationSettings,
  type PersonalNotificationSite,
} from "../notifications/notificationApi";
import { errorMessage } from "../api/errors";

const notificationLabels: Record<keyof NotificationSettings, string> = {
  newWorkItems: "Nye oppdrag",
  workItemChanges: "Endringer i oppdrag",
  decisionsRequired: "Lederhandling kreves",
  childWorkCompleted: "Leveranser fra underenheter",
  planningCompleted: "Planlegging ferdig",
  executionCompleted: "Utførelse ferdig",
};

export function PersonalNotificationsPanel({ disabled }: { disabled: boolean }) {
  const [sites, setSites] = useState<PersonalNotificationSite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    setSites(await loadPersonalNotificationSettings());
  }

  useEffect(() => {
    void load();
  }, []);

  async function toggle(
    site: PersonalNotificationSite,
    key: keyof NotificationSettings,
    value: boolean,
  ) {
    const next = { ...site, [key]: value };
    setSites((current) =>
      current.map((candidate) => candidate.siteId === site.siteId ? next : candidate),
    );
    setBusy(true);
    setMessage("");
    try {
      await savePersonalNotificationSettings(site.siteId, {
        newWorkItems: next.newWorkItems,
        workItemChanges: next.workItemChanges,
        decisionsRequired: next.decisionsRequired,
        childWorkCompleted: next.childWorkCompleted,
        planningCompleted: next.planningCompleted,
        executionCompleted: next.executionCompleted,
      });
      setMessage("Varslingsvalgene er lagret.");
    } catch (problem) {
      setMessage(errorMessage(problem,"Varslingsvalgene kunne ikke lagres."));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (sites.length === 0) return null;

  return (
    <section className="panel stacked-form profile-notifications">
      <div>
        <h2>Personlige varslinger</h2>
        <p className="muted">
          Utgangspunktet er sitens varslingsvalg. Du kan dempe e-postvarsler for
          deg selv uten å påvirke andre.
        </p>
      </div>
      {sites.map((site) => (
        <div className="notification-profile-site" key={site.siteId}>
          <h3>{site.name}</h3>
          <div className="notification-options">
            {Object.entries(notificationLabels).map(([rawKey, label]) => {
              const key = rawKey as keyof NotificationSettings;
              return (
                <label className="checkbox-row" key={key}>
                  <input
                    type="checkbox"
                    checked={site[key]}
                    disabled={disabled || busy || !site.available[key]}
                    onChange={(event) => void toggle(site, key, event.target.checked)}
                  />
                  <span>
                    {label}
                    {!site.available[key] && (
                      <small className="muted"> Ikke aktivert for siten</small>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
      {message && <p className="muted" role="status">{message}</p>}
    </section>
  );
}
