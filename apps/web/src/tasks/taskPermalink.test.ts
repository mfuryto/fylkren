import { describe, expect, it, vi } from "vitest";
import { isResolvedTaskPermalinkQuery, isUnavailableTaskPermalink, type LoadedTaskQuery } from "./taskPermalink";

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

  it("does not infer missing access from a queue response alone", async () => {
    await expect(isUnavailableTaskPermalink([], "task-new", async () => ({ task: { id: "task-new" } })))
      .resolves.toBe(false);
  });

  it("reports an unavailable task only after the direct access check fails", async () => {
    await expect(isUnavailableTaskPermalink([], "task-missing", async () => {
      throw new Error("Not found");
    })).resolves.toBe(true);
  });

  it("does not request confirmation when the task is already in the queue", async () => {
    const confirmAccess = vi.fn();
    await expect(isUnavailableTaskPermalink([{ id: "task-new" }], "task-new", confirmAccess))
      .resolves.toBe(false);
    expect(confirmAccess).not.toHaveBeenCalled();
  });
});
