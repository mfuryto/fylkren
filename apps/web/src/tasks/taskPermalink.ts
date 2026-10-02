export type LoadedTaskQuery = {
  siteId: string;
  unitId: string;
  filter: string;
  search: string;
  sort: string;
  page: number;
  focusItemId?: string;
};

export function isResolvedTaskPermalinkQuery(loaded: LoadedTaskQuery | null, expected: {
  siteId: string;
  unitId: string;
  filter: string;
  search: string;
  itemId: string;
}) {
  return loaded?.siteId === expected.siteId &&
    loaded.focusItemId === expected.itemId &&
    loaded.unitId === expected.unitId &&
    loaded.filter === expected.filter &&
    loaded.search === expected.search;
}

export async function isUnavailableTaskPermalink(
  items: ReadonlyArray<{ id: string }>,
  itemId: string,
  confirmAccess: () => Promise<unknown>,
) {
  if (items.some(item => item.id === itemId)) return false;
  try {
    await confirmAccess();
    return false;
  } catch {
    return true;
  }
}
