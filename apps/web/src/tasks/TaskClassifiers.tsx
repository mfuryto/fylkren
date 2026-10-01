import type { WorkItem } from "../work/WorkItemModels";
import { isReceivedRequest, priorityLabel } from "./taskPolicy";

export function TaskClassifiers({ item, delegation = false }: { item: WorkItem; delegation?: boolean }) {
  const receivedRequest = isReceivedRequest(item);
  return <div className="task-classifiers">
    {item.isOutgoingRequest && <span className="task-info-badge request-direction-badge request-direction-sent"><i aria-hidden="true">↗</i>Sent request</span>}
    {!delegation && receivedRequest && <span className="task-info-badge request-direction-badge request-direction-received"><i aria-hidden="true">↙</i>Received request</span>}
    {item.status !== "registered" && <span className={`task-info-badge task-priority ${item.priority}`}><i aria-hidden="true">◆</i>{priorityLabel(item.priority)}</span>}
    {item.workItemTypeName && <span className="task-info-badge task-type-badge"><i aria-hidden="true">▣</i>{item.workItemTypeName}</span>}
    {item.sourceTypeName && <span className="task-info-badge task-source-badge"><i aria-hidden="true">◈</i>{item.sourceTypeName}</span>}
    {item.senderName && <span className="task-info-badge task-sender-badge"><i aria-hidden="true">●</i>{item.senderName}</span>}
    {item.senderSiteName && <span className="task-info-badge task-source-badge"><i aria-hidden="true">◆</i>{delegation ? "From" : receivedRequest ? "Sender" : "From"}: {item.senderSiteName}</span>}
    {item.senderPersonName && (delegation || !receivedRequest) && <span className="task-info-badge task-sender-badge"><i aria-hidden="true">●</i>Sendt of {item.senderPersonName}</span>}
    {item.referenceUrl && <a className="task-info-badge task-document-badge" href={item.referenceUrl} target="_blank" rel="noopener noreferrer"><i aria-hidden="true">▤</i>Hoveddokument</a>}
  </div>;
}
