import { useCallback, useEffect, useState } from "react";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { WorkItem, WorkItemType } from "../work/WorkItemModels";
import { getTaskContext, getWorkItemLookups, getWorkItems, getWorkItemTypes } from "./taskApi";

export function useTaskData(onError: (message: string) => void, personId: string | undefined, preferredSiteId: string | undefined, query: { unitId: string; filter: string; search: string; page: number; focusItemId?: string }) {
  const [sites, setSites] = useState<TaskSite[]>([]);
  const [taskUnits, setTaskUnits] = useState<TaskUnit[]>([]);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [types, setTypes] = useState<WorkItemType[]>([]);
  const [sourceTypes, setSourceTypes] = useState<WorkItemType[]>([]);
  const [senders, setSenders] = useState<WorkItemType[]>([]);
  const [itemTotal, setItemTotal] = useState(0);
  const [itemPage, setItemPage] = useState(1);
  const [itemSummary, setItemSummary] = useState({ active: 0, inProgress: 0, inReview: 0, overdue: 0 });
  const [selectedSiteId, setSelectedSiteId] = useState("");

  const loadItems = useCallback(async (siteId: string) => {
    if (!siteId) { setItems([]); return; }
    try { const result = await getWorkItems(siteId, query); setItems(result.items); setItemTotal(result.total); setItemPage(result.page); setItemSummary(result.summary); onError(""); }
    catch (problem) { onError(problem instanceof Error ? problem.message : "Oppgavene kunne ikke lastes."); }
  }, [onError, query.unitId, query.filter, query.search, query.page, query.focusItemId]);

  const loadTypes = useCallback(async (siteId: string) => {
    if (!siteId) { setTypes([]); return; }
    try { setTypes(await getWorkItemTypes(siteId)); }
    catch (problem) { onError(problem instanceof Error ? problem.message : "Oppgavetypene kunne ikke lastes."); }
  }, [onError]);

  const loadLookups = useCallback(async (siteId: string) => {
    if (!siteId) { setSourceTypes([]); setSenders([]); return; }
    try {
      const lookups = await getWorkItemLookups(siteId);
      setSourceTypes(lookups.sourceTypes);
      setSenders(lookups.senders);
    } catch (problem) { onError(problem instanceof Error ? problem.message : "Oppslagsverdiene kunne ikke lastes."); }
  }, [onError]);

  useEffect(() => {
    let active = true;
    void getTaskContext(personId).then(data => {
      if (!active) return;
      const operationalSites = data.sites.filter(site => site.hasOperationalAccess);
      setSites(operationalSites);
      setTaskUnits(data.units);
      setSelectedSiteId(current => operationalSites.some(site => site.siteId === current) ? current : operationalSites.find(site => site.siteId === preferredSiteId)?.siteId ?? operationalSites[0]?.siteId ?? "");
    }).catch(problem => { if (active) onError(problem instanceof Error ? problem.message : "Oppgavekonteksten kunne ikke lastes."); });
    return () => { active = false; };
  }, [onError, personId, preferredSiteId]);

  useEffect(() => {
    setItems([]); setTypes([]); setSourceTypes([]); setSenders([]);
    if (!selectedSiteId) return;
    let active = true;
    void Promise.allSettled([
      getWorkItemTypes(selectedSiteId),
      getWorkItemLookups(selectedSiteId),
    ]).then(([typeResult, lookupResult]) => {
      if (!active) return;
      if (typeResult.status === "fulfilled") setTypes(typeResult.value);
      if (lookupResult.status === "fulfilled") {
        setSourceTypes(lookupResult.value.sourceTypes);
        setSenders(lookupResult.value.senders);
      }
      const failure = [typeResult, lookupResult].find(result => result.status === "rejected");
      if (failure?.status === "rejected") onError(failure.reason instanceof Error ? failure.reason.message : "Oppgavedataene kunne ikke lastes.");
      else onError("");
    });
    return () => { active = false; };
  }, [selectedSiteId, onError]);

  useEffect(() => { void loadItems(selectedSiteId); }, [selectedSiteId, loadItems]);

  return { sites, taskUnits, items, itemTotal, itemPage, itemSummary, types, sourceTypes, senders, selectedSiteId, setSelectedSiteId, loadItems, loadTypes, loadLookups };
}
