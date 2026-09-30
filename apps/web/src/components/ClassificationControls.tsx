export type ClassificationMarking = {
  name: string;
  abbreviation: string;
};

export function ClassificationControls({
  value,
  onChange,
  markings,
}: {
  value: string;
  onChange: (value: string) => void;
  markings: ClassificationMarking[];
}) {
  const t = useTranslation();
  if (markings.length === 0) return null;

  const selected = markings.find((marking) =>
    value.startsWith(`(${marking.abbreviation}) `),
  );
  const unmarked = selected
    ? value.slice(selected.abbreviation.length + 3)
    : value;

  return (
    <div className="classification-controls" aria-label={t("classificationMarking")}>
      <span>{t("marking")}</span>
      <button
        className={!selected ? "selected" : ""}
        type="button"
        onClick={() => onChange(unmarked)}
      >
        {t("none")}
      </button>
      {markings.map((marking) => (
        <button
          className={
            selected?.abbreviation === marking.abbreviation ? "selected" : ""
          }
          type="button"
          key={marking.abbreviation}
          title={marking.name}
          onClick={() => onChange(`(${marking.abbreviation}) ${unmarked}`)}
        >
          {marking.name} ({marking.abbreviation})
        </button>
      ))}
    </div>
  );
}
import { useTranslation } from "../localization/LocalizationProvider";
