import type { MessageKey } from "../localization";
import { useTranslation } from "../localization/LocalizationProvider";

export type ListSort = "newest" | "oldest" | "name-asc" | "name-desc" | "reference-asc" | "reference-desc";

const labels: Record<ListSort, MessageKey> = {
  newest: "sortNewest",
  oldest: "sortOldest",
  "name-asc": "sortNameAscending",
  "name-desc": "sortNameDescending",
  "reference-asc": "sortReferenceAscending",
  "reference-desc": "sortReferenceDescending",
};

export function ListSortControl({ id, value, onChange, options = ["newest", "oldest", "name-asc", "name-desc"] }: {
  id: string;
  value: ListSort;
  onChange: (value: ListSort) => void;
  options?: ListSort[];
}) {
  const t = useTranslation();
  return <div className="field list-sort-control">
    <label htmlFor={id}>{t("sortBy")}</label>
    <select id={id} value={value} onChange={event => onChange(event.target.value as ListSort)}>
      {options.map(option => <option value={option} key={option}>{t(labels[option])}</option>)}
    </select>
  </div>;
}

export function sortList<T>(values: readonly T[], sort: ListSort, fields: {
  name: (value: T) => string;
  createdAt?: (value: T) => string | null | undefined;
  reference?: (value: T) => string | null | undefined;
}, language?: string) {
  if ((sort === "newest" || sort === "oldest") && !fields.createdAt)
    return sort === "newest" ? [...values] : [...values].reverse();
  const direction = sort.endsWith("desc") || sort === "newest" ? -1 : 1;
  const text = sort.startsWith("reference") ? (fields.reference ?? fields.name) : fields.name;
  return [...values].sort((left, right) => {
    if ((sort === "newest" || sort === "oldest") && fields.createdAt) {
      const compared = (fields.createdAt(left) ?? "").localeCompare(fields.createdAt(right) ?? "");
      if (compared) return compared * direction;
    }
    return (text(left) ?? "").localeCompare(text(right) ?? "", language, { numeric: true, sensitivity: "base" }) * direction;
  });
}
