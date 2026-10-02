import { describe, expect, it } from "vitest";
import { isResolvedTaskPermalinkQuery, type LoadedTaskQuery } from "./taskPermalink";

const loaded: LoadedTaskQuery = {
  siteId: "site-a", unitId: "", filter: "all", search: "", sort: "newest", page: 1, focusItemId: "task-new",
};

describe("task permalink query state", () => {
  it("waits for the response containing the requested task before deciding that it is missing", () => {
    expect(isResolvedTaskPermalinkQuery({ ...loaded, focusItemId: "task-old" }, {
      siteId: "site-a", unitId: "", filter: "all", search: "", itemId: "task-new",
    })).toBe(false);
    expect(isResolvedTaskPermalinkQuery({ ...loaded, filter: "active" }, {
      siteId: "site-a", unitId: "", filter: "all", search: "", itemId: "task-new",
    })).toBe(false);
  });

  it("resolves only the exact current site, scope, filter, search and task", () => {
    expect(isResolvedTaskPermalinkQuery(loaded, {
      siteId: "site-a", unitId: "", filter: "all", search: "", itemId: "task-new",
    })).toBe(true);
  });
});
