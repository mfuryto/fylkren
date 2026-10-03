import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalizationProvider } from "../localization/LocalizationProvider";
import { supportedLanguages, translate } from "../localization";
import { ActivityButton, ActivityEntry } from "./ActivityTimeline";
import { WorkLifecycleButton } from "./WorkLifecycleButton";

describe("shared activity and information actions", () => {
  it("renders compact keyboard dialog actions with Norwegian context", () => {
    const html = renderToStaticMarkup(<LocalizationProvider language="nb-NO"><ActivityButton siteId="site" itemId="item" /><WorkLifecycleButton siteId="site" itemId="item" /></LocalizationProvider>);
    expect(html).toContain("Aktivitet"); expect(html).toContain("Lukking og arkivering"); expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(2); expect(html).not.toContain("textarea");
  });
  it("keeps attribution inert and conceals unknown technical event names", () => {
    const html = renderToStaticMarkup(<LocalizationProvider language="en-US"><ActivityEntry timeZone="UTC" row={{ id: "event", type: "secret.future.event", occurredAt: "2026-10-02T10:30:00Z", actorName: '<img src=x onerror="alert(1)">', source: "local", actorKind: "person", contextWorkItemId: "item" }} /></LocalizationProvider>);
    expect(html).not.toContain("<img"); expect(html).not.toContain("secret.future.event"); expect(html).toContain("&lt;img"); expect(html).toContain("Activity recorded"); expect(html).toContain("10:30");
  });
  it("has lifecycle and incomplete-history wording in every supported language", () => {
    for (const language of supportedLanguages) for (const key of ["activityTitle", "activityLegacyNotice", "lifecycleReason", "lifecycleRestore", "lifecycleAction", "lifecycleActiveDescription", "lifecycleClosedDescription", "lifecycleArchivedDescription", "lifecycleReasonHelp", "lifecycleHeldNotice"] as const) expect(translate(language, key)).not.toBe(key);
    expect(translate("nb-NO", "activityLegacyNotice")).toContain("ufullstendig");
  });
});
