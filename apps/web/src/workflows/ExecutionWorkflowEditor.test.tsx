import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { ExecutionItem } from "./ExecutionModels";
import { ExecutionWorkflowEditor } from "./ExecutionWorkflowEditor";

describe("execution step actions", () => {
  it("keeps external dialogue separate from requests sent in Fylkren", () => {
    const item = {
      id: "item",
      title: "Task",
      run: {
        id: "run",
        definitionId: "definition",
        definitionName: "Standard",
        claimedByPersonId: "person",
        status: "in_progress",
        currentStep: 0,
        timelineStartedOn: null,
        steps: [{
          id: "step",
          name: "Execution",
          sortOrder: 10,
          isOptional: false,
          hasTimeline: false,
          content: "",
          timelineEvents: [],
          externalRequests: [],
        }],
      },
    } as unknown as ExecutionItem;
    const noop = vi.fn();
    const html = renderToStaticMarkup(<ExecutionWorkflowEditor
      item={item}
      language="nb-NO"
      definitions={[]}
      selectedDefinitions={{}}
      setSelectedDefinitions={noop}
      drafts={{}}
      setDrafts={noop}
      timelineDrafts={{}}
      setTimelineDrafts={noop}
      externalDraft={{ runId: "run", stepId: "step", recipient: "", requestText: "" }}
      setExternalDraft={noop}
      responseDraft={null}
      setResponseDraft={noop}
      onMutate={async () => undefined}
      onSaveStep={async () => undefined}
      onError={noop}
      canSendRequest
      onSendRequest={noop}
    />);

    expect(html).toContain("External follow-up");
    expect(html).toContain("Record dialogue with an external party outside Fylkren.");
    expect(html).toContain("Record external dialogue");
    expect(html).toContain('class="step-navigation"');
    expect(html).toContain('class="secondary-button execution-follow-up-button"');
    expect(html).toContain("External follow-up");
    expect(html).toContain('class="secondary-button execution-request-button"');
    expect(html).toContain("Send request");
    expect(html.indexOf("External follow-up")).toBeLessThan(html.indexOf('class="step-navigation"'));
  });
});
