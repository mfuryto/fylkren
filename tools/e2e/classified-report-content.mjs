const sections = [
  ['Scope and mandate', 'The work covered operational readiness, decision ownership, evidence quality, and the controlled handoff from execution to review. The team compared the approved mandate with the completed activities and recorded every material deviation. No work outside the assigned top-level context was included.'],
  ['Method', 'Evidence was collected from the rendered workflow, the authenticated application state, and the formal reporting path. Each observation was checked against the assigned task, the selected execution workflow, and the completion criteria. Conflicting observations would have been retained for review instead of silently reconciled.'],
  ['Activities completed', 'The responsible leader accepted the assignment, selected the appropriate execution flow, and completed every required step. Supporting notes were entered as the work progressed. The final review confirmed that the recorded sequence matched the actual operational sequence and that no mandatory transition had been skipped.'],
  ['Control observations', 'Access remained limited to the identities created for this isolated test. The author and approver operated through separate authenticated sessions and held equivalent operational authority for the work context. The approval was performed only after the report had been saved and the author session had ended.'],
  ['Evidence assessment', 'The available evidence was sufficient, internally consistent, and attributable to named actors. Dates, task metadata, authorship, approval, and classification were preserved in the formal report view. The archive representation was compared with the completed task state before the result was accepted.'],
  ['Risk review', 'No unresolved high-impact risk was identified in the executed scope. Residual risk remains for controls that require external infrastructure or assistive technology and those controls are intentionally excluded from this report. The exclusions do not change the conclusion for the local browser and document path covered here.'],
  ['Decision record', 'The completed activities satisfy the assigned acceptance criteria for this scenario. The report may therefore proceed to independent approval. This decision is limited to the evidence described here and does not imply acceptance of unrelated roadmap gates or deployment environments.'],
  ['Follow-up', 'Future verification should preserve the same separation of duties and repeat the document checks when report styling, pagination, classification handling, or browser versions change. Real mail transport, accessibility behavior, and additional browser engines remain separate follow-up controls.'],
];

export function buildMultiPageReportHtml() {
  const body = sections.map(([heading, paragraph], index) => `
    <h1>${index + 1}. ${heading}</h1>
    <p>${paragraph}</p>
    <p>${paragraph} This repeated evidence paragraph deliberately exercises page flow while retaining meaningful, reviewable content.</p>`).join('');
  return `<h1>Executive summary</h1><p>Task completed.</p>${body}
    <h1>Conclusion</h1><p>Accepted. Final verification marker.</p>`;
}
