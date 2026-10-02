import { describe, expect, it } from "vitest";
import { sortList } from "./ListSortControl";

const values = [
  { name: "Zulu", createdAt: "2026-01-02T00:00:00Z", reference: "OPS-000010" },
  { name: "Alpha", createdAt: "2026-01-03T00:00:00Z", reference: "OPS-000002" },
  { name: "Bravo", createdAt: "2026-01-01T00:00:00Z", reference: "OPS-000001" },
];
const fields = {
  name: (value: typeof values[number]) => value.name,
  createdAt: (value: typeof values[number]) => value.createdAt,
  reference: (value: typeof values[number]) => value.reference,
};

describe("sortList", () => {
  it("sorts time-based lists newest first by default", () => {
    expect(sortList(values, "newest", fields).map(value => value.name)).toEqual(["Alpha", "Zulu", "Bravo"]);
  });

  it("sorts names and numeric references in both directions", () => {
    expect(sortList(values, "name-asc", fields).map(value => value.name)).toEqual(["Alpha", "Bravo", "Zulu"]);
    expect(sortList(values, "reference-desc", fields).map(value => value.reference)).toEqual(["OPS-000010", "OPS-000002", "OPS-000001"]);
  });

  it("preserves server order for newest when timestamps are unavailable", () => {
    expect(sortList(values, "newest", { name: fields.name })).toEqual(values);
    expect(sortList(values, "oldest", { name: fields.name })).toEqual([...values].reverse());
  });
});
