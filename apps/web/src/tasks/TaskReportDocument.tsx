import { translateActive } from "../localization";
import { createElement } from "react";
import type { ClassificationMarking } from "../components/ClassificationControls";
import { RichTextContent } from "../components/RichText";
import type { WorkItem } from "../work/WorkItemModels";

export function TaskReportDocument({ item, siteName, unitPath, rootTitle, marking, language, timeZone }: {
  item: WorkItem; siteName?: string; unitPath: string[]; rootTitle: string;
  marking?: ClassificationMarking; language: string; timeZone: string;
}) {
  const date = (value: string | null) => value ? new Date(value).toLocaleDateString(language, { timeZone }) : translateActive("notRegistered");
  const body = (item.finalReport ?? "").replace(/^(#{1,4})\s+/gm, (_match, hashes: string) => `${"#".repeat(hashes.length + 1)} `);
  return <article className="report-document report-upstream">
    {marking && <><div className="report-page-mark report-page-mark-header">{marking.name}</div><div className="report-page-mark report-page-mark-footer">{marking.name}</div></>}
    <h1>{siteName}</h1>
    {unitPath.map((name, index) => createElement(`h${Math.min(index + 2, 6)}`, { key: `${index}-${name}`, className: "report-organization-heading" }, name))}
    <dl className="report-metadata">
      <div><dt>{translateActive("approvalTask")}</dt><dd>{rootTitle}</dd></div><div><dt>{translateActive("dateLabel")}</dt><dd>{date(item.finalReportCreatedAt ?? item.finalReportUpdatedAt)}</dd></div>
      <div><dt>{translateActive("workReceived")}</dt><dd>{date(item.createdAt)}</dd></div><div><dt>{translateActive("workCompleted")}</dt><dd>{date(item.finalReportUpdatedAt)}</dd></div>
      <div><dt>{translateActive("reportWrittenBy")}</dt><dd>{item.finalReportWrittenBy ?? item.createdBy}</dd></div><div><dt>{translateActive("reportApprovedBy")}</dt><dd>{item.finalReportApprovedBy ?? translateActive("notRegistered")}</dd></div>
    </dl><RichTextContent value={body} />
  </article>;
}
